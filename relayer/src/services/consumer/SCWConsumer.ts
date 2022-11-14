import { ConsumeMessage } from 'amqplib';
import { ICacheService } from '../../../../common/cache';
import { logger } from '../../../../common/log-config';
import { IQueue } from '../../../../common/queue';
import { EVMRawTransactionType, SCWTransactionMessageType, TransactionType } from '../../../../common/types';
import { getRetryTransactionCountKey } from '../../../../common/utils';
import { IEVMAccount } from '../account';
import { IRelayerManager } from '../relayer-manager/interface/IRelayerManager';
import { ITransactionService } from '../transaction-service';
import { ITransactionConsumer } from './interface/ITransactionConsumer';
import { SCWConsumerParamsType } from './types';

const log = logger(module);
export class SCWConsumer implements
ITransactionConsumer<IEVMAccount, EVMRawTransactionType> {
  private transactionType: TransactionType = TransactionType.SCW;

  private queue: IQueue<SCWTransactionMessageType>;

  chainId: number;

  relayerManager: IRelayerManager<IEVMAccount, EVMRawTransactionType>;

  transactionService: ITransactionService<IEVMAccount, EVMRawTransactionType>;

  cacheService: ICacheService;

  constructor(
    scwConsumerParamsType: SCWConsumerParamsType,
  ) {
    const {
      options, queue, relayerManager, transactionService, cacheService,
    } = scwConsumerParamsType;
    this.queue = queue;
    this.relayerManager = relayerManager;
    this.transactionService = transactionService;
    this.cacheService = cacheService;
    this.chainId = options.chainId;
  }

  onMessageReceived = async (
    msg?: ConsumeMessage,
  ): Promise<void> => {
    if (msg) {
      const transactionDataReceivedFromQueue = JSON.parse(msg.content.toString());
      log.info(`onMessage received in ${this.transactionType}: ${JSON.stringify(transactionDataReceivedFromQueue)}`);
      this.queue.ack(msg);

      // get active relayer
      const activeRelayer = await this.relayerManager.getActiveRelayer();
      log.info(`Active relayer for ${this.transactionType} is ${activeRelayer?.getPublicKey()}`);
      if (activeRelayer) {
        await this.cacheService.set(getRetryTransactionCountKey(
          transactionDataReceivedFromQueue.transactionId,
          this.chainId,
        ), '0');

        const transactionServiceResponse = await this.transactionService.sendTransaction(
          transactionDataReceivedFromQueue,
          activeRelayer,
          this.transactionType,
          this.relayerManager.name,
        );
        log.info(`Response from transaction service after sending transaction on chaindId: ${this.chainId}: ${JSON.stringify(transactionServiceResponse)}`);
        this.relayerManager.addActiveRelayer(activeRelayer.getPublicKey());
        if (transactionServiceResponse.state === 'success') {
          log.info(`Transaction sent successfully for ${this.transactionType} on chain ${this.chainId}`);
        } else {
          log.error(`Transaction failed with error: ${transactionServiceResponse?.error || 'unknown error'} for ${this.transactionType} on chain ${this.chainId}`);
        }
      } else {
        this.queue.publish(JSON.parse(msg.content.toString()));
        log.info(`No active relayer for transactionType: ${this.transactionType} on chainId: ${this.chainId}`);
      }
    } else {
      throw new Error(`No msg received from queue for transactionType: ${this.transactionType} on chainId: ${this.chainId}`);
    }
  };
}
