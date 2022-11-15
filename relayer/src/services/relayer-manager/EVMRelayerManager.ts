/* eslint-disable no-await-in-loop */
import { Mutex } from 'async-mutex';
import {
  privateToPublic,
  publicToAddress,
  toChecksumAddress,
} from 'ethereumjs-util';
import { ethers } from 'ethers';
import hdkey from 'hdkey';
import { IGasPrice } from '../../../../common/gas-price';
import { GasPriceType } from '../../../../common/gas-price/types';
import { logger } from '../../../../common/log-config';
import { INetworkService } from '../../../../common/network';
import {
  EVMRawTransactionType,
  TransactionType,
} from '../../../../common/types';
import { generateTransactionId } from '../../../../common/utils';
import { config } from '../../../../config';
import { EVMAccount, IEVMAccount } from '../account';
import { INonceManager } from '../nonce-manager';
import { EVMRelayerMetaDataType, IRelayerQueue } from '../relayer-queue';
import { ITransactionService } from '../transaction-service/interface/ITransactionService';
import { IRelayerManager } from './interface/IRelayerManager';
import { EVMRelayerManagerServiceParamsType } from './types';

const log = logger(module);

const fundRelayerMutex = new Mutex();
const createRelayerMutex = new Mutex();
const nodePathRoot = "m/44'/60'/0'/";

/**
 * Function of relayer manager
 * 1. create relayers for supported networks
 * 2. fund relayer for the first time from main account
 * 4. maintain state of relayer and choose from the algo when transactions are happening
 * 5. Update balance, nonce, check thresholds
 * 6. increase number of relayer if load
 * 7. fee manager interaction with relayer manager
 * Convert either from main account or convert per relayer
 */

export class EVMRelayerManager
implements IRelayerManager<IEVMAccount, EVMRawTransactionType> {
  name: string;

  chainId: number;

  transactionService: ITransactionService<IEVMAccount, EVMRawTransactionType>;

  private minRelayerCount: number;

  private maxRelayerCount: number;

  private inactiveRelayerCountThreshold: number;

  private pendingTransactionCountThreshold: number;

  newRelayerInstanceCount: number;

  fundingBalanceThreshold: ethers.BigNumber;

  fundingRelayerAmount: number;

  relayerSeed: string;

  ownerAccountDetails: IEVMAccount;

  gasLimitMap: {
    [key: number]: number;
  };

  relayerQueue: IRelayerQueue<EVMRelayerMetaDataType>;

  relayerMap: Record<string, IEVMAccount> = {};

  transactionProcessingRelayerMap: Record<string, EVMRelayerMetaDataType> = {};

  nonceManager: INonceManager<IEVMAccount, EVMRawTransactionType>;

  networkService: INetworkService<IEVMAccount, EVMRawTransactionType>;

  gasPriceService: IGasPrice;

  constructor(
    evmRelayerManagerServiceParams: EVMRelayerManagerServiceParamsType,
  ) {
    const {
      options,
      networkService,
      gasPriceService,
      nonceManager,
      relayerQueue,
      transactionService,
    } = evmRelayerManagerServiceParams;
    this.chainId = options.chainId;
    this.name = options.name;
    this.minRelayerCount = options.minRelayerCount;
    this.maxRelayerCount = options.maxRelayerCount;
    this.inactiveRelayerCountThreshold = options.inactiveRelayerCountThreshold;
    this.pendingTransactionCountThreshold = options.pendingTransactionCountThreshold;
    this.newRelayerInstanceCount = options.newRelayerInstanceCount;
    this.fundingBalanceThreshold = options.fundingBalanceThreshold;
    this.fundingRelayerAmount = options.fundingRelayerAmount;
    this.ownerAccountDetails = options.ownerAccountDetails;
    this.relayerSeed = options.relayerSeed;
    this.gasLimitMap = options.gasLimitMap;
    this.relayerQueue = relayerQueue;
    this.networkService = networkService;
    this.gasPriceService = gasPriceService;
    this.transactionService = transactionService;
    this.nonceManager = nonceManager;
  }

  /**
   * Fetches active relayer from the queue
   * @returns An active relayer instance
   */
  async getActiveRelayer(): Promise<IEVMAccount | null> {
    const activeRelayer = await this.relayerQueue.pop();
    if (activeRelayer) {
      activeRelayer.pendingCount += 1;
      this.transactionProcessingRelayerMap[activeRelayer.address] = activeRelayer;
      return this.relayerMap[activeRelayer.address];
    }
    return null;
  }

  /**
   * Once a transaction is mined, the method decreases relayer's pending count,
   * updates the balance and checks if funding is required for that relayer
   * @param relayerAddress
   */
  async postTransactionMined(relayerAddress: string): Promise<void> {
    const address = relayerAddress.toLowerCase();
    let relayerData = this.relayerQueue
      .list()
      .find((relayer) => relayer.address === address);
    if (!relayerData) {
      // if relayer is performing transaction then it would not be available in relayer queue
      relayerData = this.transactionProcessingRelayerMap[address];
    }
    if (relayerData) {
      relayerData.pendingCount -= 1;
      log.info(`Pending count of relayer ${address} is ${relayerData.pendingCount} on chainId: ${this.chainId}`);
      const balance = await this.networkService.getBalance(address);
      relayerData.balance = balance;
      log.info(`Balance of relayer ${address} is ${balance} on chainId: ${this.chainId}`);
      // if balance is less than threshold, fund the relayer
      if (balance.lt(this.fundingBalanceThreshold)) {
        try {
          await this.fundRelayers([address]);
        } catch (error) {
          log.info(`Error while funding relayer ${address}:- ${error} on chainId: ${this.chainId}`);
        }
      }
    } else {
      log.info(`Relayer ${address} is not found in relayer queue or transaction processing relayer map on chainId: ${this.chainId}`);
    }
  }

  /**
   * Method fetches the instance of a relayer
   * @param relayerAddress
   * @returns Instance of a relayer
   */
  getRelayer(relayerAddress: string): IEVMAccount | null {
    const address = relayerAddress.toLowerCase();
    const relayer = this.relayerMap[address];
    if (relayer) {
      return relayer;
    }
    return null;
  }

  /**
   * Method adds active relayer active relater queue
   * @param relayerAddress
   */
  async addActiveRelayer(relayerAddress: string): Promise<void> {
    const address = relayerAddress.toLowerCase();
    log.info(
      `Adding relayer: ${address} to active relayer map on chainId: ${this.chainId}`,
    );
    const relayer = this.transactionProcessingRelayerMap[address];
    if (relayer) {
      // check if pending count of relayer is less than threshold
      // else you wait for the transaction to be mined
      if (relayer.pendingCount < this.pendingTransactionCountThreshold) {
        await this.relayerQueue.push(relayer);
      }
      delete this.transactionProcessingRelayerMap[address];

      // check if size of active relayer queue is
      // greater than or equal to the inactiveRelayerCountThreshold
      if ((this.minRelayerCount - this.relayerQueue.size()) >= this.inactiveRelayerCountThreshold) {
        await this.createRelayers(this.newRelayerInstanceCount);
      }
      log.info(
        `Relayer ${address} added to active relayer map on chainId: ${this.chainId}`,
      );
    } else {
      log.error(
        `Relayer ${address} not found in processing relayer map on chainId: ${this.chainId}`,
      );
    }
  }

  /**
   * Method gets list of relayers with data
   * @returns list of relayers with data
   */
  getRelayers(): any {
    const relayerDataMap: any = {};
    const relayers = Object.keys(this.relayerMap);
    // iterate over relayers and get balance and nonce from relayer queue
    for (const relayer of relayers) {
      const data = this.relayerQueue.get(relayer);
      if (data) {
        relayerDataMap[relayer].balance = data.balance;
        relayerDataMap[relayer].nonce = data.nonce;
      }
    }
    return relayerDataMap;
  }

  /**
   * Methods gets count of active relayers or total relayers
   * @param active true if to get count of active relayers
   * @returns count of active relayers or total relayers
   */
  getRelayersCount(active: boolean = false): number {
    if (active) {
      return this.relayerQueue.size();
    }
    return Object.keys(this.relayerMap).length;
  }

  /**
   * Method creates relayers at run time basis on config values
   * @param numberOfRelayers number of relayers to create, default set to value set in config
   * @returns List of addresses of newly created relayers
   */
  async createRelayers(
    numberOfRelayers: number = this.minRelayerCount,
  ): Promise<string[]> {
    log.info(`Waiting for lock to create relayers on chainId: ${this.chainId}`);
    const release = await createRelayerMutex.acquire();
    log.info(`Received lock to create relayers on chainId ${this.chainId}`);
    const relayersMasterSeed = this.relayerSeed;
    const relayers: IEVMAccount[] = [];
    const relayersAddressList: string[] = [];
    try {
      const index = this.getRelayersCount();
      for (
        let relayerIndex = index;
        relayerIndex < index + numberOfRelayers;
        relayerIndex += 1
      ) {
        const seedInBuffer = Buffer.from(relayersMasterSeed, 'utf-8');
        const ethRoot = hdkey.fromMasterSeed(seedInBuffer);

        const { nodePathIndex } = config.relayer;
        const nodePath = `${nodePathRoot + nodePathIndex}/`;
        const ethNodePath: any = ethRoot.derive(nodePath + relayerIndex);
        const privateKey = ethNodePath._privateKey.toString('hex');
        const ethPubkey = privateToPublic(ethNodePath.privateKey);

        const ethAddr = publicToAddress(ethPubkey).toString('hex');
        const ethAddress = toChecksumAddress(`0x${ethAddr}`);
        const address = ethAddress.toLowerCase();
        const relayer = new EVMAccount(address, privateKey);
        this.relayerMap[address] = relayer;
        relayers.push(relayer);
      }

      for (const relayer of relayers) {
        const relayerAddress = relayer.getPublicKey().toLowerCase();
        try {
          log.info(`Creating relayer ${relayerAddress} on chainId: ${this.chainId}`);
          const balance = await this.networkService.getBalance(relayerAddress);
          const nonce = await this.nonceManager.getNonce(relayerAddress);
          this.relayerQueue.push({
            address: relayer.getPublicKey(),
            pendingCount: 0,
            nonce,
            balance,
          });
          relayersAddressList.push(relayerAddress);
        } catch (error) {
          log.error(error);
          log.info(
            `Error while getting balance and nonce for relayer ${relayerAddress} on chainId: ${this.chainId}`,
          );
        }
      }
    } catch (error) {
      log.error(
        `failed to create relayers ${JSON.stringify(error)} on chainId: ${
          this.chainId
        }`,
      );
    }

    release();
    log.info(
      `Lock released after creating relayers on chainId: ${this.chainId}`,
    );
    return relayersAddressList;
  }

  /**
   * Method checks if balance of relayer is below threshold or not
   * @param relayerAddress
   * @returns returns true or false basis on balance of relayer
   */
  hasBalanceBelowThreshold(relayerAddress: string): boolean {
    const address = relayerAddress.toLowerCase();
    const relayerData = this.relayerQueue
      .list()
      .find((relayer) => relayer.address === address);
    if (relayerData) {
      const relayerBalance = relayerData.balance;
      log.info(
        `Relayer ${address} balance is ${relayerBalance} on chainId: ${this.chainId}`,
      );
      if (relayerBalance.lte(this.fundingBalanceThreshold)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Method funds the relayers basis on config values
   * @param addressList List of relayers to fund
   */
  async fundRelayers(addressList: string[]): Promise<any> {
    log.info(`Waiting for lock to fund relayers on chainId: ${this.chainId}`);
    for (const relayerAddress of addressList) {
      const address = relayerAddress.toLowerCase();
      const release = await fundRelayerMutex.acquire();
      if (!this.hasBalanceBelowThreshold(address)) {
        log.info(
          `Has sufficient funds in relayer ${address} on chainId: ${this.chainId}`,
        );
      } else {
        // eslint-disable-next-line no-await-in-loop
        log.info(`Funding relayer ${address} on chainId: ${this.chainId}`);
        let gasLimitIndex = 0;
        // different gas limit for arbitrum
        if ([42161, 421611].includes(this.chainId)) gasLimitIndex = 1;

        const gasLimit = this.gasLimitMap[gasLimitIndex];

        const fundingAmount = this.fundingRelayerAmount;

        const ownerAccountNonce = await this.nonceManager.getNonce(
          this.ownerAccountDetails.getPublicKey(),
        );
        const gasPrice = await this.gasPriceService.getGasPrice(
          GasPriceType.DEFAULT,
        );
        const rawTx = {
          from: this.ownerAccountDetails.getPublicKey(),
          data: '0x',
          gasPrice: ethers.BigNumber.from(gasPrice).toHexString(),
          gasLimit: ethers.BigNumber.from(gasLimit.toString()).toHexString(),
          to: address,
          value: ethers.utils
            .parseEther(fundingAmount.toString())
            .toHexString(),
          nonce: ethers.BigNumber.from(
            ownerAccountNonce.toString(),
          ).toHexString(),
          chainId: this.chainId,
        };
        const transactionId = generateTransactionId(JSON.stringify(rawTx));
        log.info(
          `Funding relayer ${address} on chainId: ${
            this.chainId
          } with raw tx ${JSON.stringify(rawTx)}`,
        );
        await this.transactionService.sendTransaction(
          {
            ...rawTx,
            transactionId,
            walletAddress: '', // TODO: review to get the wallet address
          },
          this.ownerAccountDetails,
          TransactionType.FUNDING,
          this.name,
        );
      }
      release();
    }
  }

  /**
   * Method sets minimum relayer count of the relayer manager
   * @param minRelayerCount
   */
  setMinRelayerCount(minRelayerCount: number) {
    this.minRelayerCount = minRelayerCount;
  }

  /**
   * Method gets minimum relayer count of the relayer manager
   * @returns minimum relayer count
   */
  getMinRelayerCount(): number {
    return this.minRelayerCount;
  }

  /**
   * Method sets maximum relayer count of the relayer manager
   * @param maxRelayerCount maximum relayer count
   */
  setMaxRelayerCount(maxRelayerCount: number) {
    this.maxRelayerCount = maxRelayerCount;
  }

  /**
   * Method gets maximum relayer count of the relayer manager
   * @returns  maximum relayer count
   */
  getMaxRelayerCount(): number {
    return this.maxRelayerCount;
  }

  /**
   * Method sets threshold for inactive relayer count below which relayers are scaled
   * @param threshold
   */
  setInactiveRelayerCountThreshold(threshold: number) {
    this.inactiveRelayerCountThreshold = threshold;
  }

  /**
   * Method gets threshold for inactive relayer count below which relayers are scaled
   */
  getInactiveRelayerCountThreshold() {
    return this.inactiveRelayerCountThreshold;
  }

  /**
   * Methods sets threshold for pending transaction count
   * for a single relayer above which relayer is marked as inactive
   * @param threshold
   */
  setPendingTransactionCountThreshold(threshold: number) {
    this.pendingTransactionCountThreshold = threshold;
  }

  /**
   * Methods gets threshold for pending transaction count
   * for a single relayer above which relayer is marked as inactive
   * @returns
   */
  getPendingTransactionCountThreshold() {
    return this.pendingTransactionCountThreshold;
  }
}
