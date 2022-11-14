/* eslint-disable max-len */
import { ethers } from 'ethers';
import { ICacheService } from '../../../../common/cache';
import { IGasPrice } from '../../../../common/gas-price';
import { logger } from '../../../../common/log-config';
import { INetworkService } from '../../../../common/network';
import { getMaxRetryCountNotificationMessage } from '../../../../common/notification';
import { INotificationManager } from '../../../../common/notification/interface';
import { EVMRawTransactionType, TransactionType } from '../../../../common/types';
import { getRetryTransactionCountKey, parseError } from '../../../../common/utils';
import { config } from '../../../../config';
import { IEVMAccount } from '../account';
import { INonceManager } from '../nonce-manager';
import { ITransactionListener } from '../transaction-listener';
import { ITransactionService } from './interface/ITransactionService';
import {
  CreateRawTransactionParamsType,
  CreateRawTransactionReturnType,
  ErrorTransactionResponseType,
  EVMTransactionServiceParamsType,
  ExecuteTransactionParamsType,
  ExecuteTransactionResponseType,
  RetryTransactionDataType,
  SuccessTransactionResponseType,
  TransactionDataType,
} from './types';

const log = logger(module);

export class EVMTransactionService implements
ITransactionService<IEVMAccount, EVMRawTransactionType> {
  chainId: number;

  networkService: INetworkService<IEVMAccount, EVMRawTransactionType>;

  transactionListener: ITransactionListener<IEVMAccount, EVMRawTransactionType>;

  nonceManager: INonceManager<IEVMAccount, EVMRawTransactionType>;

  gasPriceService: IGasPrice;

  cacheService: ICacheService;

  notificationManager: INotificationManager;

  constructor(evmTransactionServiceParams: EVMTransactionServiceParamsType) {
    const {
      options, networkService, transactionListener, nonceManager, gasPriceService, cacheService, notificationManager,
    } = evmTransactionServiceParams;
    this.chainId = options.chainId;
    this.networkService = networkService;
    this.transactionListener = transactionListener;
    this.nonceManager = nonceManager;
    this.gasPriceService = gasPriceService;
    this.cacheService = cacheService;
    this.notificationManager = notificationManager;
  }

  private async createTransaction(
    createTransactionParams: CreateRawTransactionParamsType,
  ): Promise<CreateRawTransactionReturnType> {
    // create raw transaction basis on data passed
    const {
      from,
      to,
      value,
      data,
      gasLimit,
      speed,
      account,
    } = createTransactionParams;
    const relayerAddress = account.getPublicKey();

    const nonce = await this.nonceManager.getNonce(relayerAddress, false);
    log.info(`Nonce for relayerAddress: ${nonce}`);
    const response = {
      from,
      to,
      value,
      gasLimit,
      data,
      chainId: this.chainId,
      nonce,
    };
    const gasPrice = await this.gasPriceService.getGasPrice(speed);
    if (typeof gasPrice !== 'string') {
      log.info(`Gas price being used to send transaction by relayer: ${relayerAddress} is: ${JSON.stringify(gasPrice)}`);
      const {
        maxPriorityFeePerGas,
        maxFeePerGas,
      } = gasPrice;
      return {
        ...response,
        maxFeePerGas: ethers.utils.hexlify(Number(maxFeePerGas)),
        maxPriorityFeePerGas: ethers.utils.hexlify(Number(maxPriorityFeePerGas)),
      };
    }
    log.info(`Gas price being used to send transaction by relayer: ${relayerAddress} is: ${gasPrice}`);
    return { ...response, gasPrice: ethers.utils.hexlify(Number(gasPrice)) };
  }

  async executeTransaction(
    executeTransactionParams: ExecuteTransactionParamsType,
  ): Promise<ExecuteTransactionResponseType> {
    const { rawTransaction, account } = executeTransactionParams;
    try {
      const transactionExecutionResponse = await this.networkService.sendTransaction(
        rawTransaction,
        account,
      );
      if (transactionExecutionResponse instanceof Error) {
        return {
          success: false,
          error: parseError(transactionExecutionResponse),
        };
      }
      return {
        success: true,
        transactionResponse: transactionExecutionResponse,
      };
    } catch (error: any) {
      // TODO: should we add transactionId here ?
      log.info(`Error while executing transaction: ${error}`);
      const errInString = parseError(error);
      const nonceErrorMessage = config.transaction.errors.networksNonceError[this.chainId];
      const replacementFeeLowMessage = config.transaction.errors.networkResponseMessages
        .REPLACEMENT_UNDERPRICED;
      const alreadyKnownMessage = config.transaction
        .errors.networkResponseMessages.ALREADY_KNOWN;
      const insufficientFundsErrorMessage = config
        .transaction.errors.networksInsufficientFundsError[this.chainId]
      || config.transaction.errors.networkResponseMessages.INSUFFICIENT_FUNDS;

      if (errInString.indexOf(nonceErrorMessage) > -1
    || errInString.indexOf('increasing the gas price or incrementing the nonce') > -1) {
        log.info(
          `Nonce too low error for relayer ${rawTransaction.from}
    on network id ${this.chainId}. Removing nonce from cache and retrying`,
        );
        rawTransaction.nonce = await this.networkService
          .getNonce(rawTransaction.from, true);
        log.info(`updating the nonce to ${rawTransaction.nonce}
     for relayer ${rawTransaction.from} on network id ${this.chainId}`);
      } else if (errInString.indexOf(replacementFeeLowMessage) > -1) {
        log.info(
          `Replacement underpriced error for relayer ${rawTransaction.from}
     on network id ${this.chainId}`,
        );
        let { gasPrice } = await this.networkService.getGasPrice();

        log.info(`gas price from network ${gasPrice}`);
        const gasPriceInNumber = ethers.BigNumber.from(
          gasPrice.toString(),
        ).toNumber();

        log.info(`rawTransaction.gasPrice ${rawTransaction.gasPrice} for relayer ${rawTransaction.from} on network id ${this.chainId}`);

        if (rawTransaction.gasPrice && gasPrice < rawTransaction.gasPrice) {
          gasPrice = rawTransaction.gasPrice;
        }
        log.info(`transaction sent with gas price ${rawTransaction.gasPrice} for relayer ${rawTransaction.from} on network id ${this.chainId}`);
        log.info(`Bumping up gas price with multiplier ${config.transaction.bumpGasPriceMultiplier[this.chainId]} for relayer ${rawTransaction.from} on network id ${this.chainId}`);
        log.info(`gasPriceInNumber ${gasPriceInNumber} for relayer ${rawTransaction.from} on network id ${this.chainId}`);
        rawTransaction.gasPrice = Math.round(config.transaction.bumpGasPriceMultiplier[this.chainId] * gasPriceInNumber).toString();
        log.info(`increasing gas price for the resubmit transaction ${rawTransaction.gasPrice} for relayer ${rawTransaction.from} on network id ${this.chainId}`);
      } else if (errInString.indexOf(alreadyKnownMessage) > -1) {
        log.info(
          `Already known transaction hash with same payload and nonce for relayer ${rawTransaction.from} on network id ${this.chainId}. Removing nonce from cache and retrying`,
        );
      } else if (errInString.indexOf(insufficientFundsErrorMessage) > -1) {
        log.info(`Relayer ${rawTransaction.from} has insufficient funds`);
        // Send previous relayer for funding
      } else {
        log.info('transaction not being retried');
        return {
          success: false,
          error: 'transaction not being retried',
        };
      }
      return {
        success: false,
        error: errInString,
      };
    }
  }

  private async sendMaxRetryCountExceededSlackNotification(
    transactionId: string,
    account: IEVMAccount,
    transactionType: TransactionType,
    chainId: number,
  ) {
    const maxRetryCountNotificationMessage = getMaxRetryCountNotificationMessage(
      transactionId,
      account,
      transactionType,
      chainId,
    );
    const slackNotifyObject = this.notificationManager.getSlackNotifyObject(maxRetryCountNotificationMessage);
    await this.notificationManager.sendSlackNotification(slackNotifyObject);
  }

  async sendTransaction(
    transactionData: TransactionDataType,
    account: IEVMAccount,
    transactionType: TransactionType,
    relayerManagerName: string,
  ): Promise<SuccessTransactionResponseType | ErrorTransactionResponseType> {
    const relayerAddress = account.getPublicKey();
    const {
      to, value, data, gasLimit,
      speed, transactionId, walletAddress, metaData,
    } = transactionData;

    const retryTransactionCount = parseInt(await this.cacheService.get(getRetryTransactionCountKey(transactionId, this.chainId)), 10);

    const maxRetryCount = config.transaction.retryCount[transactionType][this.chainId];

    if (retryTransactionCount > maxRetryCount) {
      try {
      // send slack notification
        await this.sendMaxRetryCountExceededSlackNotification(
          transactionData.transactionId,
          account,
          transactionType,
          this.chainId,
        );
      } catch (error) {
        log.error(error);
        log.error('Error in sending slack notification');
      }
      // Should we send this response if we are manaully resubmitting transaction?
      return {
        state: 'failed',
        code: 404, // TODO custom code for max retry
        error: 'Max retry count exceeded. Use end point to get transaction status', // todo add end point
        transactionId,
        ...{
          isTransactionRelayed: false,
          transactionExecutionResponse: null,
        },
      };
    }

    log.info(`Transaction request received with transactionId: ${transactionId} on chainId ${this.chainId}`);
    // create transaction
    const rawTransaction = await this.createTransaction({
      from: relayerAddress,
      to,
      value,
      data,
      gasLimit,
      speed,
      account,
    });
    log.info(`Raw transaction for transactionId: ${transactionId} is ${JSON.stringify(rawTransaction)} on chainId ${this.chainId}`);

    try {
      const transactionExecutionResponse = await this.executeTransaction({
        rawTransaction,
        account,
      });
      if (!transactionExecutionResponse.success) {
        await this.transactionListener.notify({
          transactionId: transactionId as string,
          relayerAddress,
          transactionType,
          previousTransactionHash: undefined,
          rawTransaction,
          walletAddress,
          metaData,
          relayerManagerName,
          error: transactionExecutionResponse.error,
        });
        throw new Error('Error in transaction execution');
      }

      log.info(`Transaction execution response for transactionId ${transactionData.transactionId}: ${JSON.stringify(transactionExecutionResponse)} on chainId ${this.chainId}`);

      log.info(`Incrementing nonce for account: ${relayerAddress} on chainId ${this.chainId}`);
      await this.nonceManager.incrementNonce(relayerAddress);
      log.info(`Incremented nonce for account: ${relayerAddress} on chainId ${this.chainId}`);

      log.info(`Notifying transaction listener for transactionId: ${transactionId} on chainId ${this.chainId}`);
      const transactionListenerNotifyResponse = await this.transactionListener.notify({
        transactionExecutionResponse: transactionExecutionResponse.transactionResponse,
        transactionId: transactionId as string,
        relayerAddress,
        transactionType,
        previousTransactionHash: undefined,
        rawTransaction,
        walletAddress,
        metaData,
        relayerManagerName,
      });

      return {
        state: 'success',
        code: 200,
        transactionId,
        ...transactionListenerNotifyResponse,
      };
    } catch (error) {
      log.info(`Error while sending transaction: ${error}`);
      return {
        state: 'failed',
        code: 500,
        error: JSON.stringify(error),
        transactionId,
        ...{
          isTransactionRelayed: false,
          transactionExecutionResponse: null,
        },
      };
    }
  }

  async retryTransaction(
    retryTransactionData: RetryTransactionDataType,
    account: IEVMAccount,
    transactionType: TransactionType,
  ): Promise<SuccessTransactionResponseType | ErrorTransactionResponseType> {
    const {
      transactionHash,
      transactionId,
      rawTransaction,
      walletAddress,
      metaData,
      relayerManagerName,
    } = retryTransactionData;
    try {
      await this.cacheService.increment(getRetryTransactionCountKey(transactionId, this.chainId));

      // TODO // Make it generel and EIP 1559 specific and get bump up from config
      const bumpedUpGasPrice = this.gasPriceService.getBumpedUpGasPrice(
        rawTransaction.gasPrice as string,
        config.transaction.bumpGasPriceMultiplier[this.chainId],
      );

      rawTransaction.gasPrice = bumpedUpGasPrice as string;
      log.info(`Executing retry transaction for transactionId: ${transactionId}`);
      const retryTransactionExecutionResponse = await this.executeTransaction({
        rawTransaction,
        account,
      });
      let transactionExecutionResponse;
      if (retryTransactionExecutionResponse.success) {
        transactionExecutionResponse = retryTransactionExecutionResponse.transactionResponse;
      } else {
        return {
          state: 'failed',
          code: 500,
          error: JSON.stringify(retryTransactionExecutionResponse.error),
          transactionId,
          ...{
            isTransactionRelayed: false,
            transactionExecutionResponse: null,
          },
        };
      }

      log.info(`Notifying transaction listener for transactionId: ${transactionId} on chainId ${this.chainId}`);
      const transactionListenerNotifyResponse = await this.transactionListener.notify({
        transactionExecutionResponse,
        transactionId: transactionId as string,
        relayerAddress: account.getPublicKey(),
        rawTransaction,
        transactionType,
        previousTransactionHash: transactionHash,
        walletAddress,
        metaData,
        relayerManagerName,
      });

      return {
        state: 'success',
        code: 200,
        transactionId,
        ...transactionListenerNotifyResponse,
      };
    } catch (error) {
      log.info(`Error while retrying transaction: ${error} for transactionId: ${transactionId} on chainId: ${this.chainId}`);
      return {
        state: 'failed',
        code: 500,
        error: JSON.stringify(error),
        transactionId,
        ...{
          isTransactionRelayed: false,
          transactionExecutionResponse: null,
        },
      };
    }
  }
}
