/* eslint-disable no-await-in-loop */
import { BigNumber, ethers } from 'ethers';
import { config } from '../../config';
import { EVMNetworkService } from '../../common/network';
import { logger } from '../../common/log-config';
import { EVMAccount } from '../../relayer/src/services/account';

const log = logger(module);

const networkServiceMap: {
  [chainId: number]: EVMNetworkService;
} = {};

for (const supportedNetwork of config.supportedNetworks) {
  networkServiceMap[supportedNetwork] = new EVMNetworkService({
    chainId: supportedNetwork,
    rpcUrl: config.chains.provider[supportedNetwork],
    fallbackRpcUrls: config.chains.fallbackUrls[supportedNetwork] || [],
  });
}

describe('Network Service: Rpc Urls', () => {
  it('Main rpc url should be active for chainId: 5', async () => {
    const { data } = await networkServiceMap[5].sendRpcCall('eth_blockNumber', []);
    const blockNumber = Number(BigNumber.from(data.result));
    expect(blockNumber).toBeGreaterThan(0);
  });

  it('Main rpc url should be active for chainId: 80001', async () => {
    const { data } = await networkServiceMap[80001].sendRpcCall('eth_blockNumber', []);
    const blockNumber = Number(BigNumber.from(data.result));
    expect(blockNumber).toBeGreaterThan(0);
  });

  it('Fallback urls should be active for chaindId: 5', async () => {
    for (
      let fallBackRpcUrlIndex = 0;
      fallBackRpcUrlIndex < networkServiceMap[5].fallbackRpcUrls.length;
      fallBackRpcUrlIndex += 1
    ) {
      const fallBackRpcUrl = networkServiceMap[5].fallbackRpcUrls[fallBackRpcUrlIndex];
      log.info(`Checking rpcUrl: ${fallBackRpcUrl}`);
      networkServiceMap[5].setActiveRpcUrl(fallBackRpcUrl);
      const { data } = await networkServiceMap[5].sendRpcCall('eth_blockNumber', []);
      const blockNumber = Number(BigNumber.from(data.result));
      expect(blockNumber).toBeGreaterThan(0);
    }
  });

  it('Fallback urls should be active for chaindId: 80001', async () => {
    for (
      let fallBackRpcUrlIndex = 0;
      fallBackRpcUrlIndex < networkServiceMap[80001].fallbackRpcUrls.length;
      fallBackRpcUrlIndex += 1
    ) {
      const fallBackRpcUrl = networkServiceMap[80001].fallbackRpcUrls[fallBackRpcUrlIndex];
      log.info(`Checking rpcUrl: ${fallBackRpcUrl}`);
      networkServiceMap[80001].setActiveRpcUrl(fallBackRpcUrl);
      const { data } = await networkServiceMap[80001].sendRpcCall('eth_blockNumber', []);
      const blockNumber = Number(BigNumber.from(data.result));
      expect(blockNumber).toBeGreaterThan(0);
    }
  });
});

describe('Network Service: Gas Prices', () => {
  it('Type 0 transaction type gas price is not null/zero for chainId: 5', async () => {
    const { gasPrice } = await networkServiceMap[5].getGasPrice();
    expect(gasPrice).not.toBeNull();
    expect(typeof gasPrice).toBe('string');
    expect(Number(gasPrice)).toBeGreaterThan(0);
  });

  it('Type 0 transaction type gas price is not null/zero for chainId: 80001', async () => {
    const { gasPrice } = await networkServiceMap[80001].getGasPrice();
    expect(gasPrice).not.toBeNull();
    expect(typeof gasPrice).toBe('string');
    expect(Number(gasPrice)).toBeGreaterThan(0);
  });

  it('Type 2 transaction type gas price is not null/zero for chainId: 5', async () => {
    const {
      maxPriorityFeePerGas,
      maxFeePerGas,
    } = await networkServiceMap[5].getEIP1559GasPrice();
    expect(maxPriorityFeePerGas).not.toBeNull();
    expect(typeof maxPriorityFeePerGas).toBe('string');
    expect(Number(maxPriorityFeePerGas)).toBeGreaterThan(0);

    expect(maxFeePerGas).not.toBeNull();
    expect(typeof maxFeePerGas).toBe('string');
    expect(Number(maxFeePerGas)).toBeGreaterThan(0);
  });

  it('Type 2 transaction type gas price is not null/zero for chainId: 80001', async () => {
    const {
      maxPriorityFeePerGas,
      maxFeePerGas,
    } = await networkServiceMap[80001].getEIP1559GasPrice();
    expect(maxPriorityFeePerGas).not.toBeNull();
    expect(typeof maxPriorityFeePerGas).toBe('string');
    expect(Number(maxPriorityFeePerGas)).toBeGreaterThan(0);

    expect(maxFeePerGas).not.toBeNull();
    expect(typeof maxFeePerGas).toBe('string');
    expect(Number(maxFeePerGas)).toBeGreaterThan(0);
  });
});

describe('Network Service: Native Asset Balance', () => {
  it('Fetches the correct native asset balance on chainId: 80001', async () => {
    // test wallet
    const wallet = ethers.Wallet.createRandom();

    // owner address
    // const ownerAddressPublicKey = '0x4C07E2fa10f9871142883139B32Cb03F2A180494';
    const ownerAddressPrivateKey = 'e3b3818b1b604cf6dfc3133faa9a524f1e2ea0d5894a003c4b857952f6b146f6';
    const ownerWallet = new ethers.Wallet(
      ownerAddressPrivateKey,
      networkServiceMap[80001].ethersProvider,
    );
    const { gasPrice } = await networkServiceMap[80001].getGasPrice();

    // transfer 0.00001 native token from main account
    const transactionResponse = await ownerWallet.sendTransaction({
      to: wallet.address,
      from: ownerWallet.address,
      nonce: networkServiceMap[80001].getNonce(ownerWallet.address),
      gasLimit: 21000,
      gasPrice,
      value: BigNumber.from('10000000'),
    });

    await networkServiceMap[80001].waitForTransaction(transactionResponse.hash);

    // check if the getBalance gets 0.00001
    const walletBalance = Number(await networkServiceMap[80001].getBalance(wallet.address));
    expect(walletBalance).not.toBeNull();
    expect(typeof walletBalance).toBe('number');
    expect(walletBalance).toBe(10000000);
  });

  it('Fetches the correct native asset balance on chainId: 5', async () => {
    // test wallet
    const wallet = ethers.Wallet.createRandom();

    // owner address
    // const ownerAddressPublicKey = '0x4C07E2fa10f9871142883139B32Cb03F2A180494';
    const ownerAddressPrivateKey = 'e3b3818b1b604cf6dfc3133faa9a524f1e2ea0d5894a003c4b857952f6b146f6';
    const ownerWallet = new ethers.Wallet(
      ownerAddressPrivateKey,
      networkServiceMap[5].ethersProvider,
    );
    const { gasPrice } = await networkServiceMap[5].getGasPrice();

    // transfer 0.00001 native token from main account
    const transactionResponse = await ownerWallet.sendTransaction({
      to: wallet.address,
      from: ownerWallet.address,
      nonce: networkServiceMap[5].getNonce(ownerWallet.address),
      gasLimit: 21000,
      gasPrice,
      value: BigNumber.from('10000000'),
    });

    await networkServiceMap[5].waitForTransaction(transactionResponse.hash);

    // check if the getBalance gets 0.00001
    const walletBalance = Number(await networkServiceMap[5].getBalance(wallet.address));

    expect(walletBalance).not.toBeNull();
    expect(typeof walletBalance).toBe('number');
    expect(walletBalance).toBe(10000000);
  });
});

describe('Network Service: Nonce Check', () => {
  it('Check if nonce is correctly incremented on chaindId: 80001', async () => {
    // call getNonce() on an address, nonce should x

    // owner address
    const ownerAddressPublicKey = '0x4C07E2fa10f9871142883139B32Cb03F2A180494';
    const ownerAddressPrivateKey = 'e3b3818b1b604cf6dfc3133faa9a524f1e2ea0d5894a003c4b857952f6b146f6';
    const ownerWallet = new ethers.Wallet(
      ownerAddressPrivateKey,
      networkServiceMap[80001].ethersProvider,
    );

    const nonceBeforeTransaction = await networkServiceMap[80001].getNonce(ownerAddressPublicKey);
    const { gasPrice } = await networkServiceMap[80001].getGasPrice();

    // do a transaction
    // transfer 0.00001 native token from main account
    await ownerWallet.sendTransaction({
      to: ownerAddressPublicKey,
      from: ownerAddressPublicKey,
      nonce: networkServiceMap[80001].getNonce(ownerAddressPublicKey),
      gasLimit: 21000,
      gasPrice,
      value: BigNumber.from('10000000'),
    });

    // then call getNonce() on that address, nonce should x + 1
    const nonceAfterTransaction = await networkServiceMap[80001].getNonce(ownerAddressPublicKey);
    const nonceDifference = nonceAfterTransaction - nonceBeforeTransaction;
    expect(nonceDifference).toBe(1);
  });

  it('Check if nonce is correctly incremented on chaindId: 5', async () => {
    // call getNonce() on an address, nonce should x

    // owner address
    const ownerAddressPublicKey = '0x4C07E2fa10f9871142883139B32Cb03F2A180494';
    const ownerAddressPrivateKey = 'e3b3818b1b604cf6dfc3133faa9a524f1e2ea0d5894a003c4b857952f6b146f6';
    const ownerWallet = new ethers.Wallet(
      ownerAddressPrivateKey,
      networkServiceMap[5].ethersProvider,
    );

    const nonceBeforeTransaction = await networkServiceMap[5].getNonce(ownerAddressPublicKey);
    const { gasPrice } = await networkServiceMap[5].getGasPrice();

    // do a transaction
    // transfer 0.00001 native token from main account
    await ownerWallet.sendTransaction({
      to: ownerAddressPublicKey,
      from: ownerAddressPublicKey,
      nonce: networkServiceMap[5].getNonce(ownerAddressPublicKey),
      gasLimit: 21000,
      gasPrice,
      value: BigNumber.from('10000000'),
    });

    // then call getNonce() on that address, nonce should x + 1
    const nonceAfterTransaction = await networkServiceMap[5].getNonce(ownerAddressPublicKey);
    const nonceDifference = nonceAfterTransaction - nonceBeforeTransaction;
    expect(nonceDifference).toBe(1);
  });
});

describe('Network Service: Sending Transaction', () => {
  it('Transaction should be sent and confirm on chainId: 80001', async () => {
    const wallet = ethers.Wallet.createRandom();

    // owner address
    const ownerAddressPublicKey = '0x4C07E2fa10f9871142883139B32Cb03F2A180494';
    const ownerAddressPrivateKey = 'e3b3818b1b604cf6dfc3133faa9a524f1e2ea0d5894a003c4b857952f6b146f6';

    const evmAccount = new EVMAccount(ownerAddressPublicKey, ownerAddressPrivateKey);

    const { gasPrice } = await networkServiceMap[80001].getGasPrice();
    const nonce = await networkServiceMap[80001].getNonce(ownerAddressPublicKey);

    const rawTransactionData = {
      from: ownerAddressPublicKey,
      gasPrice,
      data: '0x',
      gasLimit: '0x989680',
      to: wallet.address,
      value: '0x989680',
      chainId: 80001,
      nonce,
    };

    const transactionExecutionResponse = await networkServiceMap[80001]
      .sendTransaction(rawTransactionData, evmAccount);

    const { hash } = transactionExecutionResponse;

    const transactionReceipt = await networkServiceMap[80001].waitForTransaction(hash);
    expect(transactionReceipt).not.toBeNull();
    expect(transactionReceipt.status).toBe(1);
  });

  it('Transaction should be sent and confirm on chainId: 5', async () => {
    const wallet = ethers.Wallet.createRandom();

    // owner address
    const ownerAddressPublicKey = '0x4C07E2fa10f9871142883139B32Cb03F2A180494';
    const ownerAddressPrivateKey = 'e3b3818b1b604cf6dfc3133faa9a524f1e2ea0d5894a003c4b857952f6b146f6';

    const evmAccount = new EVMAccount(ownerAddressPublicKey, ownerAddressPrivateKey);

    const { gasPrice } = await networkServiceMap[5].getGasPrice();
    const nonce = await networkServiceMap[5].getNonce(ownerAddressPublicKey);

    const rawTransactionData = {
      from: ownerAddressPublicKey,
      gasPrice,
      data: '0x',
      gasLimit: '0x989680',
      to: wallet.address,
      value: '0x989680',
      chainId: 5,
      nonce,
    };

    const transactionExecutionResponse = await networkServiceMap[5]
      .sendTransaction(rawTransactionData, evmAccount);

    const { hash } = transactionExecutionResponse;

    const transactionReceipt = await networkServiceMap[5].waitForTransaction(hash);
    expect(transactionReceipt).not.toBeNull();
    expect(transactionReceipt.status).toBe(1);
  });
});
