/* eslint-disable no-await-in-loop */
import axios from 'axios';
import { BigNumber, ethers } from 'ethers';
import EventEmitter from 'events';
import { IEVMAccount } from '../../relayer/src/services/account';
import { ERC20_ABI } from '../constants';
import { logger } from '../log-config';
import { EVMRawTransactionType } from '../types';
import { IERC20NetworkService, INetworkService, RpcMethod } from './interface';
import { Type0TransactionGasPriceType, Type2TransactionGasPriceType } from './types';

const log = logger(module);
export class EVMNetworkService implements INetworkService<IEVMAccount, EVMRawTransactionType>,
 IERC20NetworkService {
  chainId: number;

  rpcUrl: string;

  ethersProvider: ethers.providers.JsonRpcProvider;

  fallbackRpcUrls: string[];

  constructor(options: { chainId: number; rpcUrl: string; fallbackRpcUrls: string[] }) {
    this.chainId = options.chainId;
    this.rpcUrl = options.rpcUrl;
    this.fallbackRpcUrls = options.fallbackRpcUrls;
    this.ethersProvider = new ethers.providers.JsonRpcProvider({
      url: options.rpcUrl,
      timeout: 10000,
    });
  }

  getActiveRpcUrl(): string {
    return this.rpcUrl;
  }

  setActiveRpcUrl(rpcUrl: string): void {
    this.rpcUrl = rpcUrl;
  }

  getFallbackRpcUrls(): string[] {
    return this.fallbackRpcUrls;
  }

  setFallbackRpcUrls(fallbackRpcUrls: string[]): void {
    this.fallbackRpcUrls = fallbackRpcUrls;
  }

  // REVIEW
  // change any to some defined type
  /**
   * method to handle various rpc methods
   * and fallback to other rpc urls if the current rpc url fails
   * @param tag RpcMethod enum
   * @param params parameters required for the rpc method
   * @returns based on the rpc method
   */
  useProvider = async (tag: RpcMethod, params?: any): Promise<any> => {
    let rpcUrlIndex = 0;
    // eslint-disable-next-line consistent-return
    const withFallbackRetry = async () => {
      try {
        // TODO Add null checks on params
        switch (tag) {
          case RpcMethod.getGasPrice:
            return await this.ethersProvider.getGasPrice();
          case RpcMethod.getEIP1159GasPrice:
            return await this.ethersProvider.getFeeData();
          case RpcMethod.getBalance:
            return await this.ethersProvider.getBalance(params.address);
          case RpcMethod.estimateGas:
            return await this.ethersProvider.estimateGas(params);
          case RpcMethod.getTransactionReceipt:
            return await this.ethersProvider.getTransactionReceipt(params);
          case RpcMethod.getTransactionCount:
            if (params.pendingNonce === true) {
              return await this.ethersProvider.getTransactionCount(params.address, 'pending');
            }
            return await this.ethersProvider.getTransactionCount(params.address);
          case RpcMethod.sendTransaction:
            return await this.ethersProvider.sendTransaction(params.tx);
          case RpcMethod.waitForTransaction:
            return await this.ethersProvider.waitForTransaction(params.transactionHash);
          default:
            return null;
        }
      } catch (error: any) {
        if (error.toString().toLowerCase().includes() === 'timeout error') {
          log.info(`Error in network service ${error}`);
          for (; rpcUrlIndex < this.fallbackRpcUrls.length; rpcUrlIndex += 1) {
            this.ethersProvider = new ethers.providers.JsonRpcProvider(
              this.fallbackRpcUrls[rpcUrlIndex],
            );
            withFallbackRetry();
          }
        }
        return new Error(error);
      }
    };
    return withFallbackRetry();
  };

  async getEIP1559GasPrice(): Promise<Type2TransactionGasPriceType> {
    const feeData = await this.useProvider(RpcMethod.getEIP1159GasPrice);
    const maxFeePerGas = ethers.utils.hexValue(feeData.maxFeePerGas);
    const maxPriorityFeePerGas = ethers.utils.hexValue(feeData.maxPriorityFeePerGas);
    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  }

  async getGasPrice(): Promise<Type0TransactionGasPriceType> {
    const gasPrice = (await this.useProvider(RpcMethod.getGasPrice)).toHexString();
    return {
      gasPrice,
    };
  }

  async getBalance(address: string): Promise<BigNumber> {
    const balance = await this.useProvider(RpcMethod.getBalance, {
      address,
    });
    return balance;
  }

  // TODO: Avoid creating new contract instance Every time. Save & get from cache
  getContract(_abi: string, contractAddress: string): ethers.Contract {
    const abi = new ethers.utils.Interface(_abi);
    const contract = new ethers.Contract(contractAddress, abi, this.ethersProvider);
    return contract;
  }

  /**
   *
   * @param userAddress address of the user
   * @param tokenAddress address of an ERC20 token
   * @returns balance of the user having the token
   */
  async getTokenBalance(userAddress: string, tokenAddress: string): Promise<BigNumber> {
    const erc20Contract = this.getContract(JSON.stringify(ERC20_ABI), tokenAddress);
    const tokenBalance = await erc20Contract.balanceOf(userAddress);
    return tokenBalance;
  }

  /**
   * check if the user is allowed to spend the token
   * based on the allowance set by the owner address for that spender address
   * @param tokenAddress token contract adddress
   * @param ownerAddress owner address whose funds are being spent
   * @param spenderAddress spender address who is spending the funds
   * @param value value in wei
   * @returns if the user is allowed to spend the token
   */
  async checkAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    value: BigNumber,
  ): Promise<boolean> {
    const erc20Contract = this.getContract(JSON.stringify(ERC20_ABI), tokenAddress);
    let isSpenderAllowed = false;
    const tokensLeftToSpend = await erc20Contract.allowance(ownerAddress, spenderAddress);
    if (tokensLeftToSpend.sub(value) > 0) {
      isSpenderAllowed = true;
    }
    return isSpenderAllowed;
  }

  async executeReadMethod(
    abi: string,
    address: string,
    methodName: string,
    params: any,
  ): Promise<object> {
    const contract = this.getContract(abi, address);
    const contractReadMethodValue = await contract[methodName].apply(null, params);
    return contractReadMethodValue;
  }

  /**
   * Estimate gas for a transaction
   * @param contract contract instance
   * @param methodName name of the method to be executed
   * @param params parameters required for the method to be encoded
   * @param from address of the user
   * @returns estimate gas for the transaction in big number
   */

  async estimateGas(
    contract: ethers.Contract,
    methodName: string,
    params: any,
    from: string,
  ): Promise<BigNumber> {
    const contractInterface = contract.interface;
    const functionSignature = contractInterface.encodeFunctionData(methodName, params);
    const estimatedGas = await this.useProvider(RpcMethod.estimateGas, {
      from,
      to: contract.address,
      data: functionSignature,
    });
    return estimatedGas;
  }

  async getTransactionReceipt(
    transactionHash: string,
  ): Promise<ethers.providers.TransactionReceipt> {
    const transactionReceipt = await this.useProvider(
      RpcMethod.getTransactionReceipt,
      transactionHash,
    );
    return transactionReceipt;
  }

  /**
   * Get the nonce of the user
   * @param address address
   * @param pendingNonce include the nonce of the pending transaction
   * @returns by default returns the next nonce of the address
   * if pendingNonce is set to false, returns the nonce of the mined transaction
   */
  async getNonce(address: string, pendingNonce = true): Promise<number> {
    const nonce = await this.useProvider(RpcMethod.getTransactionCount, {
      pendingNonce,
      address,
    });
    return nonce;
  }

  async sendTransaction(
    rawTransactionData: EVMRawTransactionType,
    account: IEVMAccount,
  ): Promise<ethers.providers.TransactionResponse> {
    const rawTx: EVMRawTransactionType = rawTransactionData;
    rawTx.from = account.getPublicKey();
    const tx = await account.signTransaction(rawTx);
    const receipt = await this.useProvider(RpcMethod.sendTransaction, {
      tx,
      rawTx,
    });
    return receipt;
  }

  /**
   * @param transactionHash transaction hash
   * @returns receipt of the transaction once mined, else waits for the transaction to be mined
   */
  async waitForTransaction(transactionHash: string): Promise<ethers.providers.TransactionReceipt> {
    const transactionReceipt = await this.useProvider(RpcMethod.waitForTransaction, {
      transactionHash,
    });
    return transactionReceipt;
  }

  async getContractEventEmitter(
    contractAddress: string,
    contractAbi: string,
    topic: string,
    contractEventName: string,
  ): Promise<EventEmitter> {
    const filter = EVMNetworkService.createFilter(contractAddress, topic);
    const iFace = new ethers.utils.Interface(contractAbi);
    const contractTopicEventEmitter = new EventEmitter();

    this.ethersProvider.on(filter, async (contractLog) => {
      const parsedLog = iFace.parseLog(contractLog);
      contractTopicEventEmitter.emit(contractEventName, parsedLog);
    });
    return contractTopicEventEmitter;
  }

  async getDecimal(tokenAddress: string): Promise<number> {
    const erc20Contract = this.getContract(JSON.stringify(ERC20_ABI), tokenAddress);
    const decimal = await erc20Contract.decimal;
    return decimal;
  }

  async sendRpcCall(method: string, params: Array<object>): Promise<any> {
    const data = {
      method,
      params,
      jsonrpc: '2.0',
      id: 1,
    };
    const response = await axios.post(this.rpcUrl, data);
    return response;
  }

  static createFilter(contractAddress: string, topic: string) {
    return {
      address: contractAddress,
      topics: [topic],
    };
  }
}
