/* eslint-disable no-await-in-loop */
import { config } from '../../config';
import { EVMAccount, IEVMAccount } from '../../relayer/src/services/account';
import { AAConsumer, SCWConsumer, SocketConsumer } from '../../relayer/src/services/consumer';
import { EVMNonceManager } from '../../relayer/src/services/nonce-manager';
import { EVMRelayerManager, IRelayerManager } from '../../relayer/src/services/relayer-manager';
import { EVMRelayerQueue } from '../../relayer/src/services/relayer-queue';
import { EVMRetryTransactionService } from '../../relayer/src/services/retry-transaction-service';
import { EVMTransactionListener } from '../../relayer/src/services/transaction-listener';
import { EVMTransactionService } from '../../relayer/src/services/transaction-service';
import { FeeOption } from '../../server/src/services';
import { RedisCacheService } from '../cache';
import { Mongo, TransactionDAO } from '../db';
import { GasPriceManager } from '../gas-price';
import { IQueue } from '../interface';
import { logger } from '../log-config';
import { relayerManagerTransactionTypeNameMap } from '../maps';
import { EVMNetworkService } from '../network';
import { NotificationManager } from '../notification';
import { SlackNotificationService } from '../notification/slack/SlackNotificationService';
import {
  AATransactionQueue,
  RetryTransactionHandlerQueue,
  SCWTransactionQueue,
  TransactionHandlerQueue,
} from '../queue';
import { AARelayService, SCWRelayService } from '../relay-service';
import { AASimulationService, SCWSimulationService } from '../simulation';
import { TenderlySimulationService } from '../simulation/external-simulation';
import { IStatusService, StatusService } from '../status';
import { CMCTokenPriceManager } from '../token-price';
import {
  AATransactionMessageType,
  EntryPointMapType,
  EVMRawTransactionType,
  SCWTransactionMessageType,
  TransactionType,
} from '../types';

const log = logger(module);

const routeTransactionToRelayerMap: {
  [chainId: number]: {
    [transactionType: string]: AARelayService | SCWRelayService;
  };
} = {};

const feeOptionMap: {
  [chainId: number]: FeeOption;
} = {};

const aaSimulatonServiceMap: {
  [chainId: number]: AASimulationService;
} = {};

const scwSimulationServiceMap: {
  [chainId: number]: SCWSimulationService;
} = {};

const entryPointMap: EntryPointMapType = {};

const dbInstance = Mongo.getInstance();
const cacheService = RedisCacheService.getInstance();

const { supportedNetworks, supportedTransactionType } = config;

const EVMRelayerManagerMap: {
  [name: string]: {
    [chainId: number]: IRelayerManager<IEVMAccount, EVMRawTransactionType>;
  };
} = {};

const transactionDao = new TransactionDAO();

const socketConsumerMap: Record<number, SocketConsumer> = {};
const retryTransactionSerivceMap: Record<number, EVMRetryTransactionService> = {};
const transactionSerivceMap: Record<number, EVMTransactionService> = {};
const transactionListenerMap: Record<number, EVMTransactionListener> = {};
const retryTransactionQueueMap: {
  [key: number]: RetryTransactionHandlerQueue;
} = {};
const networkServiceMap: Record<number, EVMNetworkService> = {};

// eslint-disable-next-line import/no-mutable-exports
let statusService: IStatusService;

(async () => {
  await dbInstance.connect();
  await cacheService.connect();

  const slackNotificationService = new SlackNotificationService(
    config.slack.token,
    config.slack.channel,
  );
  const notificationManager = new NotificationManager(slackNotificationService);

  const tokenService = new CMCTokenPriceManager(cacheService, {
    apiKey: config.tokenPrice.coinMarketCapApi,
    networkSymbolCategories: config.tokenPrice.networkSymbols,
    updateFrequencyInSeconds: config.tokenPrice.updateFrequencyInSeconds,
    symbolMapByChainId: config.tokenPrice.symbolMapByChainId,
  });
  tokenService.schedule();

  log.info(`Setting up instances for following chainIds: ${JSON.stringify(supportedNetworks)}`);
  for (const chainId of supportedNetworks) {
    log.info(`Setup of services started for chainId: ${chainId}`);
    routeTransactionToRelayerMap[chainId] = {};
    entryPointMap[chainId] = [];

    if (!config.chains.provider[chainId]) {
      throw new Error(`No provider for chainId ${chainId}`);
    }

    log.info(`Setting up network service for chainId: ${chainId}`);
    const networkService = new EVMNetworkService({
      chainId,
      rpcUrl: config.chains.provider[chainId],
      fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
    });
    log.info(`Network service setup complete for chainId: ${chainId}`);
    networkServiceMap[chainId] = networkService;

    log.info(`Setting up gas price manager for chainId: ${chainId}`);
    const gasPriceManager = new GasPriceManager(cacheService, networkService, {
      chainId,
      EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
    });
    log.info(`Gas price manager setup complete for chainId: ${chainId}`);

    log.info(`Setting up gas price service for chainId: ${chainId}`);
    const gasPriceService = gasPriceManager.setup();
    if (gasPriceService) {
      gasPriceService.schedule();
    }
    if (!gasPriceService) {
      throw new Error(`Gasprice service is not setup for chainId ${chainId}`);
    }
    log.info(`Gas price service setup complete for chainId: ${chainId}`);

    log.info(`Setting up transaction queue for chainId: ${chainId}`);
    const transactionQueue = new TransactionHandlerQueue({
      chainId,
    });
    await transactionQueue.connect();
    log.info(`Transaction queue setup complete for chainId: ${chainId}`);

    log.info(`Setting up retry transaction queue for chainId: ${chainId}`);
    const retryTransactionQueue = new RetryTransactionHandlerQueue({
      chainId,
    });
    retryTransactionQueueMap[chainId] = retryTransactionQueue;
    await retryTransactionQueueMap[chainId].connect();
    log.info(`Retry transaction queue setup complete for chainId: ${chainId}`);

    log.info(`Setting up nonce manager for chainId: ${chainId}`);
    const nonceManager = new EVMNonceManager({
      options: {
        chainId,
      },
      networkService,
      cacheService,
    });
    log.info(`Nonce manager setup complete for chainId: ${chainId}`);

    log.info(`Setting up transaction listener for chainId: ${chainId}`);
    const transactionListener = new EVMTransactionListener({
      networkService,
      cacheService,
      transactionQueue,
      retryTransactionQueue,
      transactionDao,
      options: {
        chainId,
      },
    });
    transactionListenerMap[chainId] = transactionListener;
    log.info(`Transaction listener setup complete for chainId: ${chainId}`);

    log.info(`Setting up transaction service for chainId: ${chainId}`);
    const transactionService = new EVMTransactionService({
      networkService,
      transactionListener,
      nonceManager,
      gasPriceService,
      transactionDao,
      cacheService,
      notificationManager,
      options: {
        chainId,
      },
    });
    transactionSerivceMap[chainId] = transactionService;
    log.info(`Transaction service setup complete for chainId: ${chainId}`);

    log.info(`Setting up relayer manager for chainId: ${chainId}`);
    const relayerQueue = new EVMRelayerQueue([]);
    for (const relayerManager of config.relayerManagers) {
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
          inactiveRelayerCountThreshold: relayerManager.inactiveRelayerCountThreshold[chainId],
          pendingTransactionCountThreshold:
          relayerManager.pendingTransactionCountThreshold[chainId],
          newRelayerInstanceCount: relayerManager.newRelayerInstanceCount[chainId],
          fundingBalanceThreshold: relayerManager.fundingBalanceThreshold[chainId],
          fundingRelayerAmount: relayerManager.fundingRelayerAmount[chainId],
          ownerAccountDetails: new EVMAccount(
            relayerManager.ownerAccountDetails[chainId].publicKey,
            relayerManager.ownerAccountDetails[chainId].privateKey,
          ),
          gasLimitMap: relayerManager.gasLimitMap,
        },
      });
      EVMRelayerManagerMap[relayerManager.name][chainId] = relayerMangerInstance;

      const addressList = await relayerMangerInstance.createRelayers();
      log.info(
        `Relayer address list length: ${addressList.length} and minRelayerCount: ${relayerManager.minRelayerCount}`,
      );
      await relayerMangerInstance.fundRelayers(addressList);
    }
    log.info(`Relayer manager setup complete for chainId: ${chainId}`);

    log.info(`Setting up retry transaction service for chainId: ${chainId}`);
    retryTransactionSerivceMap[chainId] = new EVMRetryTransactionService({
      retryTransactionQueue,
      transactionService,
      networkService,
      options: {
        chainId,
        EVMRelayerManagerMap, // TODO // Review a better way
      },
    });

    retryTransactionQueueMap[chainId].consume(
      retryTransactionSerivceMap[chainId].onMessageReceived,
    );
    log.info(`Retry transaction service setup for chainId: ${chainId}`);

    log.info(`Setting up socket complete consumer for chainId: ${chainId}`);
    socketConsumerMap[chainId] = new SocketConsumer({
      queue: transactionQueue,
      options: {
        chainId,
        wssUrl: config.socketService.wssUrl,
        EVMRelayerManagerMap,
      },
    });
    transactionQueue.consume(socketConsumerMap[chainId].onMessageReceived);
    log.info(`Socket consumer setup complete for chainId: ${chainId} and attached to transaction queue`);

    log.info(`Setting up fee options service for chainId: ${chainId}`);
    const feeOptionService = new FeeOption(gasPriceService, cacheService, {
      chainId,
    });
    feeOptionMap[chainId] = feeOptionService;
    log.info(`Fee option service setup complete for chainId: ${chainId}`);

    // for each network get transaction type
    for (const type of supportedTransactionType[chainId]) {
      const aaRelayerManager = EVMRelayerManagerMap[
        relayerManagerTransactionTypeNameMap[type]][chainId];
      if (!aaRelayerManager) {
        throw new Error(`Relayer manager not found for ${type}`);
      }

      if (type === TransactionType.AA) {
        log.info(`Setting up AA transaction queue for chaindId: ${chainId}`);
        const aaQueue: IQueue<AATransactionMessageType> = new AATransactionQueue({
          chainId,
        });

        await aaQueue.connect();
        log.info(`AA transaction queue setup complete for chainId: ${chainId}`);

        const { entryPointData } = config;

        for (
          let entryPointIndex = 0;
          entryPointIndex < entryPointData[chainId].length;
          entryPointIndex += 1
        ) {
          const entryPoint = entryPointData[chainId][entryPointIndex];

          entryPointMap[chainId].push({
            address: entryPoint.address,
            entryPointContract: networkService.getContract(
              JSON.stringify(entryPoint.abi),
              entryPoint.address,
            ),
          });
        }

        log.info(`Setting up AA consumer, relay service & simulation service for chainId: ${chainId}`);
        const aaConsumer = new AAConsumer({
          queue: aaQueue,
          relayerManager: aaRelayerManager,
          transactionService,
          cacheService,
          options: {
            chainId,
            entryPointMap,
          },
        });
        // start listening for transaction
        await aaQueue.consume(aaConsumer.onMessageReceived);

        const aaRelayService = new AARelayService(aaQueue);
        routeTransactionToRelayerMap[chainId][type] = aaRelayService;

        aaSimulatonServiceMap[chainId] = new AASimulationService(networkService);
        log.info(`AA consumer, relay service & simulation service setup complete for chainId: ${chainId}`);
      } else if (type === TransactionType.SCW) {
        // queue for scw
        log.info(`Setting up SCW transaction queue for chaindId: ${chainId}`);
        const scwQueue: IQueue<SCWTransactionMessageType> = new SCWTransactionQueue({
          chainId,
        });
        await scwQueue.connect();
        log.info(`SCW transaction queue setup complete for chainId: ${chainId}`);

        const scwRelayerManager = EVMRelayerManagerMap[
          relayerManagerTransactionTypeNameMap[type]][chainId];
        if (!scwRelayerManager) {
          throw new Error(`Relayer manager not found for ${type}`);
        }

        log.info(`Setting up SCW consumer, relay service & simulation service for chainId: ${chainId}`);
        const scwConsumer = new SCWConsumer({
          queue: scwQueue,
          relayerManager: scwRelayerManager,
          transactionService,
          cacheService,
          options: {
            chainId,
          },
        });
        await scwQueue.consume(scwConsumer.onMessageReceived);

        const scwRelayService = new SCWRelayService(scwQueue);
        routeTransactionToRelayerMap[chainId][type] = scwRelayService;

        const tenderlySimulationService = new TenderlySimulationService(gasPriceService, {
          tenderlyUser: config.simulationData.tenderlyData.tenderlyUser,
          tenderlyProject: config.simulationData.tenderlyData.tenderlyProject,
          tenderlyAccessKey: config.simulationData.tenderlyData.tenderlyAccessKey,
        });
        scwSimulationServiceMap[chainId] = new SCWSimulationService(
          networkService,
          tenderlySimulationService,
        );
        log.info(`SCW consumer, relay service & simulation service setup complete for chainId: ${chainId}`);
      }
    }
  }
  // eslint-disable-next-line no-new
  statusService = new StatusService({
    cacheService,
    networkServiceMap,
    evmRelayerManagerMap: EVMRelayerManagerMap,
    dbInstance,
  });
  log.info('<=== Config setup completed ===>');
})();

export {
  routeTransactionToRelayerMap,
  feeOptionMap,
  aaSimulatonServiceMap,
  scwSimulationServiceMap,
  entryPointMap,
  EVMRelayerManagerMap,
  transactionSerivceMap,
  transactionDao,
  statusService,
};
