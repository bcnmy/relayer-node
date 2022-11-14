import { ethers } from 'ethers';
import { RedisCacheService } from '../../common/cache';
import { IBlockchainTransaction, Mongo, TransactionDAO } from '../../common/db';
import { GasPriceManager } from '../../common/gas-price';
import { GasPriceType } from '../../common/gas-price/types';
import { relayerManagerTransactionTypeNameMap } from '../../common/maps';
import { EVMNetworkService } from '../../common/network';
import { TransactionHandlerQueue, RetryTransactionHandlerQueue } from '../../common/queue';
import { TransactionType } from '../../common/types';
import { generateTransactionId } from '../../common/utils';
import { config } from '../../config';
import { EVMAccount, IEVMAccount } from '../../relayer/src/services/account';
import { EVMNonceManager } from '../../relayer/src/services/nonce-manager';
import { EVMTransactionListener } from '../../relayer/src/services/transaction-listener';
import { EVMTransactionService } from '../../relayer/src/services/transaction-service';

const dbInstance = Mongo.getInstance();
const transactionDao = new TransactionDAO();
const cacheService = RedisCacheService.getInstance();

describe('Transaction Service: Sending Transaction on chainId: 5', () => {
  const chainId = 5;

  const networkService = new EVMNetworkService({
    chainId,
    rpcUrl: config.chains.provider[chainId],
    fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
  });

  const transactionQueue = new TransactionHandlerQueue({
    chainId,
  });

  const gasPriceManager = new GasPriceManager(cacheService, networkService, {
    chainId,
    EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
  });

  const gasPriceService = gasPriceManager.setup();
  if (gasPriceService) {
    gasPriceService.schedule();
  }
  if (!gasPriceService) {
    throw new Error(`Gasprice service is not setup for chainId ${chainId}`);
  }

  const retryTransactionQueue = new RetryTransactionHandlerQueue({
    chainId,
  });
  retryTransactionQueue.connect();

  const nonceManager = new EVMNonceManager({
    options: {
      chainId,
    },
    networkService,
    cacheService,
  });

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

  const transactionService = new EVMTransactionService({
    networkService,
    transactionListener,
    nonceManager,
    gasPriceService,
    transactionDao,
    cacheService,
    options: {
      chainId,
    },
  });

  const setQuoteAbi = [{
    inputs: [{ internalType: 'string', name: 'newQuote', type: 'string' }], name: 'setQuote', outputs: [], stateMutability: 'nonpayable', type: 'function',
  }, { inputs: [], stateMutability: 'nonpayable', type: 'constructor' }, {
    inputs: [], name: 'admin', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function',
  }, {
    inputs: [], name: 'getQuote', outputs: [{ internalType: 'string', name: 'currentQuote', type: 'string' }, { internalType: 'address', name: 'currentOwner', type: 'address' }], stateMutability: 'view', type: 'function',
  }, {
    inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function',
  }, {
    inputs: [], name: 'quote', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function',
  }];
  const setQuoteAddress = '0xe31b0bcbda693bff2529f4a1d9f7e8f6d924c6ab';

  const setQuoteContract = networkService.getContract(JSON.stringify(setQuoteAbi), setQuoteAddress);

  let nonceBeforeTransaction: number;
  let transactionExecutionResponse: ethers.providers.TransactionResponse | null;
  let transactionId: string;
  let activeRelayer: IEVMAccount | null;

  // check for null gasLimit
  // same nonce of relayer
  beforeAll(async () => {
    await dbInstance.connect();
    await cacheService.connect();
    await transactionQueue.connect();

    activeRelayer = new EVMAccount('0x040a9cbC4453B0eeaE12f3210117B422B890C1ED', 'd952fa86f1e2fed30fb3a6da6e5c24d7deb65b6bb46da3ece5f56fd39e64bbd0');

    if (!activeRelayer) {
      throw new Error(`No active relayer for transactionType: ${TransactionType.SCW} on chainId: ${chainId}`);
    }

    nonceBeforeTransaction = await nonceManager.getNonce(activeRelayer.getPublicKey());
    const { data } = await setQuoteContract.populateTransaction.setQuote(`Current time: ${Date.now()}`);

    const transactionData: any = {
      to: setQuoteAddress,
      value: '0x0',
      data: data as string,
      gasLimit: '0x249F0',
    };

    transactionId = generateTransactionId(transactionData.toString());

    transactionData.transactionId = transactionId;

    const response = await transactionService.sendTransaction(
      transactionData,
      activeRelayer,
      TransactionType.SCW,
      relayerManagerTransactionTypeNameMap.SCW,
    );
    transactionExecutionResponse = response.transactionExecutionResponse;
    transactionId = response.transactionId;
  });

  it('Transaction hash is generated', async () => {
    expect((transactionExecutionResponse as ethers.providers.TransactionResponse).hash)
      .not.toBeNull();
    expect(typeof (transactionExecutionResponse as ethers.providers.TransactionResponse).hash).toBe('string');
  });

  it('Nonce should have been incremented by 1', async () => {
    const nonceAfterTransaction = await nonceManager.getNonce(
      (activeRelayer as IEVMAccount).getPublicKey(),
    );
    const nonceDifference = nonceAfterTransaction - nonceBeforeTransaction;
    expect(nonceDifference).toBe(1);
  });

  it('Transaction is confirmed on chain', async () => {
    const transactionReceipt = await networkService.waitForTransaction(
      (transactionExecutionResponse as ethers.providers.TransactionResponse).hash,
    );
    expect(transactionReceipt.status).toBe(1);
  });

  it('Transaction Data is saved in database', async () => {
    const transactionDataFromDatabase = await transactionDao.getByTransactionId(
      chainId,
      transactionId,
    );
    expect((transactionDataFromDatabase as IBlockchainTransaction[])[0].transactionHash).toBe(
      (transactionExecutionResponse as ethers.providers.TransactionResponse).hash,
    );
  });
});

describe('Retry Transaction Service: Transaction should be bumped up and confimred on chainId: 5', () => {
  const chainId = 5;

  const networkService = new EVMNetworkService({
    chainId,
    rpcUrl: config.chains.provider[chainId],
    fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
  });

  const transactionQueue = new TransactionHandlerQueue({
    chainId,
  });

  const gasPriceManager = new GasPriceManager(cacheService, networkService, {
    chainId,
    EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
  });

  const gasPriceService = gasPriceManager.setup();
  if (gasPriceService) {
    gasPriceService.schedule();
  }
  if (!gasPriceService) {
    throw new Error(`Gasprice service is not setup for chainId ${chainId}`);
  }

  const retryTransactionQueue = new RetryTransactionHandlerQueue({
    chainId,
  });
  retryTransactionQueue.connect();

  const nonceManager = new EVMNonceManager({
    options: {
      chainId,
    },
    networkService,
    cacheService,
  });

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

  const transactionService = new EVMTransactionService({
    networkService,
    transactionListener,
    nonceManager,
    gasPriceService,
    transactionDao,
    cacheService,
    options: {
      chainId,
    },
  });

  const setQuoteAbi = [{
    inputs: [{ internalType: 'string', name: 'newQuote', type: 'string' }], name: 'setQuote', outputs: [], stateMutability: 'nonpayable', type: 'function',
  }, { inputs: [], stateMutability: 'nonpayable', type: 'constructor' }, {
    inputs: [], name: 'admin', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function',
  }, {
    inputs: [], name: 'getQuote', outputs: [{ internalType: 'string', name: 'currentQuote', type: 'string' }, { internalType: 'address', name: 'currentOwner', type: 'address' }], stateMutability: 'view', type: 'function',
  }, {
    inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function',
  }, {
    inputs: [], name: 'quote', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function',
  }];
  const setQuoteAddress = '0xe31b0bcbda693bff2529f4a1d9f7e8f6d924c6ab';

  const setQuoteContract = networkService.getContract(JSON.stringify(setQuoteAbi), setQuoteAddress);

  let nonceBeforeTransaction: number;
  let transactionExecutionResponse: ethers.providers.TransactionResponse | null;
  let transactionId: string;
  let activeRelayer: IEVMAccount | null;

  beforeAll(async () => {
    await dbInstance.connect();
    await cacheService.connect();
    await transactionQueue.connect();
    activeRelayer = new EVMAccount('0x040a9cbC4453B0eeaE12f3210117B422B890C1ED', 'd952fa86f1e2fed30fb3a6da6e5c24d7deb65b6bb46da3ece5f56fd39e64bbd0');

    if (!activeRelayer) {
      throw new Error(`No active relayer for transactionType: ${TransactionType.SCW} on chainId: ${chainId}`);
    }

    nonceBeforeTransaction = await nonceManager.getNonce(activeRelayer.getPublicKey());
    const { data } = await setQuoteContract.populateTransaction.setQuote(`Current time: ${Date.now()}`);

    const transactionData: any = {
      to: setQuoteAddress,
      value: '0x0',
      data: data as string,
      gasLimit: '0x249F0',
    };

    transactionId = generateTransactionId(transactionData.toString());

    transactionData.transactionId = transactionId;

    const currentGasPrice = await gasPriceService.getGasPrice(GasPriceType.DEFAULT);

    // Set low gas price value in cache
    await gasPriceService.setGasPrice(
      GasPriceType.DEFAULT,
      (Number(currentGasPrice) * 0.75).toString(),
    );

    const response = await transactionService.sendTransaction(
      transactionData,
      activeRelayer,
      TransactionType.SCW,
      relayerManagerTransactionTypeNameMap.SCW,
    );
    transactionExecutionResponse = response.transactionExecutionResponse;
    transactionId = response.transactionId;

    // Delete low gas price value from cache
    await gasPriceService.setGasPrice(
      GasPriceType.DEFAULT,
      currentGasPrice,
    );
  });

  it('Transaction hash is generated', async () => {
    expect((transactionExecutionResponse as ethers.providers.TransactionResponse).hash)
      .not.toBeNull();
    expect((transactionExecutionResponse as ethers.providers.TransactionResponse).hash).toBe('string');
  });

  it('Nonce should have been incremented by 1', async () => {
    const nonceAfterTransaction = await nonceManager.getNonce(
      (activeRelayer as IEVMAccount).getPublicKey(),
    );
    const nonceDifference = nonceAfterTransaction - nonceBeforeTransaction;
    expect(nonceDifference).toBe(1);
  });

  it('Transaction is confirmed on chain', async () => {
    const transactionReceipt = await networkService.waitForTransaction(
      (transactionExecutionResponse as ethers.providers.TransactionResponse).hash,
    );
    expect(transactionReceipt.status).toBe(1);
  });

  it('Transaction Data is saved in database', async () => {
    const transactionDataFromDatabase = await transactionDao.getByTransactionId(
      chainId,
      transactionId,
    );
    expect((transactionDataFromDatabase as IBlockchainTransaction[])[0].transactionHash).toBe(
      (transactionExecutionResponse as ethers.providers.TransactionResponse).hash,
    );
  });
});
