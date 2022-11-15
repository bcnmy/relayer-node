import { BigNumber, ethers } from 'ethers';
import EventEmitter from 'events';
import { Type0TransactionGasPriceType, Type2TransactionGasPriceType } from '../types';

export enum RpcMethod {
  getGasPrice,
  getEIP1159GasPrice,
  getBalance,
  estimateGas,
  getTransactionReceipt,
  getTransactionCount,
  sendTransaction,
  waitForTransaction,
}

export interface INetworkService<AccountType, RawTransactionType> {
  chainId: number;
  rpcUrl: string;
  fallbackRpcUrls: string[];
  ethersProvider: ethers.providers.JsonRpcProvider;

  getActiveRpcUrl(): string;
  setActiveRpcUrl(rpcUrl: string): void;
  getFallbackRpcUrls(): string[];
  setFallbackRpcUrls(rpcUrls: string[]): void;
  // REVIEW
  // remove any
  useProvider(tag: RpcMethod, params?: any): Promise<any>
  sendRpcCall(method: string, params: Array<object>): Promise<any>
  getGasPrice(): Promise<Type0TransactionGasPriceType>;
  getEIP1559GasPrice(): Promise<Type2TransactionGasPriceType>;
  getBalance(address: string): Promise<BigNumber>;
  getContract(abi: string, contractAddress: string): ethers.Contract;
  getNonce(address: string, pendingNonce?: boolean): Promise<number>
  executeReadMethod(
    abi: string,
    contractAddress: string,
    methodName: string,
    params: object
  ): Promise<object>;
  estimateGas(
    contract: ethers.Contract,
    methodName: string,
    params: object,
    from: string
  ): Promise<BigNumber>
  sendTransaction(
    rawTransactionData: RawTransactionType,
    account: AccountType,
  ): Promise<ethers.providers.TransactionResponse>;
  getContractEventEmitter(
    contractAddress: string,
    contractAbi: string,
    topic: string,
    contractEventName: string,
  ): Promise<EventEmitter>;
  getTransactionReceipt(transactionHash: string): Promise<ethers.providers.TransactionReceipt>;
  waitForTransaction(
    transactionHash: string
  ): Promise<ethers.providers.TransactionReceipt>
}
