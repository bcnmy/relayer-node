import { RedisCacheService } from '../../common/cache';
import { TransactionDAO } from '../../common/db';
import { GasPriceManager } from '../../common/gas-price';
import { EVMNetworkService } from '../../common/network';
import { RetryTransactionHandlerQueue, TransactionHandlerQueue } from '../../common/queue';
import { EVMRawTransactionType } from '../../common/types';
import { config } from '../../config';
import { EVMAccount, IEVMAccount } from '../../relayer/src/services/account';
import { EVMNonceManager } from '../../relayer/src/services/nonce-manager';
import { EVMRelayerManager, IRelayerManager } from '../../relayer/src/services/relayer-manager';
import { EVMRelayerQueue } from '../../relayer/src/services/relayer-queue';
import { EVMTransactionListener } from '../../relayer/src/services/transaction-listener';
import { EVMTransactionService } from '../../relayer/src/services/transaction-service';

// test relayer manager
describe('relayer manager', () => {
  const chainId = 5;

  const EVMRelayerManagerMap: {
    [name: string] : {
      [chainId: number]: IRelayerManager<IEVMAccount, EVMRawTransactionType>;
    }
  } = {};

  const cacheService = RedisCacheService.getInstance();

  const networkService = new EVMNetworkService({
    chainId,
    rpcUrl: config.chains.provider[chainId],
    fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
  });

  const gasPriceManager = new GasPriceManager(cacheService, networkService, {
    chainId,
    EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
  });

  const gasPriceService = gasPriceManager.setup();

  const transactionQueue = new TransactionHandlerQueue({
    chainId,
  });

  const retryTransactionQueue = new RetryTransactionHandlerQueue({
    chainId,
  });

  const transactionDao = new TransactionDAO();

  const transactionListener = new EVMTransactionListener({
    networkService,
    transactionQueue,
    retryTransactionQueue,
    transactionDao,
    cacheService,
    options: {
      chainId,
    },
  });

  const nonceManager = new EVMNonceManager({
    options: {
      chainId,
    },
    networkService,
    cacheService,
  });

  if (gasPriceService) {
    const transactionService = new EVMTransactionService({
      networkService,
      cacheService,
      transactionListener,
      nonceManager,
      gasPriceService,
      transactionDao,
      options: {
        chainId,
      },
    });

    const relayerQueue = new EVMRelayerQueue([]);
    const relayerManager = config.relayerManagers[0];
    if (!EVMRelayerManagerMap[relayerManager.name]) {
      EVMRelayerManagerMap[relayerManager.name] = {};
    }
    const relayerMangerInstance = new EVMRelayerManager({
      networkService,
      gasPriceService,
      transactionService,
      nonceManager,
      relayerQueue,
      options: {
        chainId,
        name: relayerManager.name,
        relayerSeed: relayerManager.relayerSeed,
        minRelayerCount: relayerManager.minRelayerCount[chainId],
        maxRelayerCount: relayerManager.maxRelayerCount[chainId],
        inactiveRelayerCountThreshold:
            relayerManager.inactiveRelayerCountThreshold[chainId],
        pendingTransactionCountThreshold:
            relayerManager.pendingTransactionCountThreshold[chainId],
        newRelayerInstanceCount:
            relayerManager.newRelayerInstanceCount[chainId],
        fundingBalanceThreshold:
            relayerManager.fundingBalanceThreshold[chainId],
        fundingRelayerAmount: relayerManager.fundingRelayerAmount[chainId],
        ownerAccountDetails: new EVMAccount(
          relayerManager.ownerAccountDetails[chainId].publicKey,
          relayerManager.ownerAccountDetails[chainId].privateKey,
        ),
        gasLimitMap: relayerManager.gasLimitMap,
      },
    });
    EVMRelayerManagerMap[relayerManager.name][chainId] = relayerMangerInstance;

    let addressList: string[] = [];
    beforeAll(async () => {
      await transactionQueue.connect();
      await retryTransactionQueue.connect();
      addressList = await relayerMangerInstance.createRelayers();
    });

    it('should return a list of relayers', async () => {
      expect(addressList.length).toBeGreaterThan(0);
    });

    it('should get total relayer count', () => {
      const totalRelayerCount = relayerMangerInstance.getRelayersCount();
      expect(typeof totalRelayerCount).toBe('number');
      expect(totalRelayerCount).toBeGreaterThan(0);
    });

    it('should get active relayer count', () => {
      const activeRelayerCount = relayerMangerInstance.getRelayersCount(true);
      expect(typeof activeRelayerCount).toBe('number');
      expect(activeRelayerCount).toBeGreaterThan(0);
    });

    it('should fund relayers', async () => {
      await relayerMangerInstance.fundRelayers(addressList);
      for (const address of addressList) {
        const isBalanceBelowThreshold = relayerMangerInstance.hasBalanceBelowThreshold(address);
        expect(isBalanceBelowThreshold).toBe(false);
        const relayerData = relayerMangerInstance.relayerQueue.list().find(
          (relayer) => relayer.address === address,
        );
        expect(relayerData).toBeDefined();
        // check balance above threshold
        expect(relayerData?.balance).toBeGreaterThan(0);
        expect(relayerData?.pendingCount).toBe(0);
      }
    });

    it('should get an active relayer', async () => {
      const relayer = relayerMangerInstance.getActiveRelayer();
      expect(relayer).toBeDefined();
    });

    it('should not add a new relayer', async () => {
      const address = '0x0000000000000000000000000000000000000000';
      await relayerMangerInstance.addActiveRelayer(address);
      const relayerData = relayerMangerInstance.relayerQueue
        .list().find((relayer) => relayer.address === address);
      expect(relayerData).toBeUndefined();
    });

    it('should set and fetch min relayer count', async () => {
      const minRelayerCount = 5;
      relayerMangerInstance.setMinRelayerCount(minRelayerCount);
      const updatedMinRelayerCount = relayerMangerInstance.getMinRelayerCount();
      expect(updatedMinRelayerCount).toBe(minRelayerCount);
    });

    it('should set and fetch max relayer count', async () => {
      const maxRelayerCount = 10;
      relayerMangerInstance.setMaxRelayerCount(maxRelayerCount);
      const updatedMaxRelayerCount = relayerMangerInstance.getMaxRelayerCount();
      expect(updatedMaxRelayerCount).toBe(maxRelayerCount);
    });

    it('should set and fetch inactive relayer count threshold', async () => {
      const inactiveRelayerCountThreshold = 10;
      relayerMangerInstance.setInactiveRelayerCountThreshold(inactiveRelayerCountThreshold);
      const updatedInactiveRelayerCountThreshold = relayerMangerInstance
        .getInactiveRelayerCountThreshold();
      expect(updatedInactiveRelayerCountThreshold).toBe(inactiveRelayerCountThreshold);
    });

    it('should set and fetch pending transaction count threshold', async () => {
      const pendingTransactionCountThreshold = 10;
      relayerMangerInstance.setPendingTransactionCountThreshold(pendingTransactionCountThreshold);
      const updatedPendingTransactionCountThreshold = relayerMangerInstance
        .getPendingTransactionCountThreshold();
      expect(updatedPendingTransactionCountThreshold).toBe(pendingTransactionCountThreshold);
    });
  }
});
