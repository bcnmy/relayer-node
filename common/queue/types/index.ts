import { ethers } from 'ethers';
import { EVMRawTransactionType, SocketEventType, TransactionType } from '../../types';

export type TransactionMessageType = ethers.providers.TransactionResponse;

export type RetryTransactionQueueData = {
  relayerAddress: string,
  transactionType: TransactionType,
  transactionHash?: string,
  transactionId: string,
  rawTransaction: EVMRawTransactionType,
  walletAddress: string,
  metaData: any,
  relayerManagerName: string,
  event: SocketEventType
};
