import mongoose from 'mongoose';
import { IBlockchainTransaction } from '../../interface/IBlockchainTransaction';

const { Schema } = mongoose;

export const BlockchainTransactionSchema = new Schema<IBlockchainTransaction>({
  transactionId: {
    type: String,
    required: true,
  },
  transactionHash: {
    type: String,
  },
  previousTransactionHash: {
    type: String,
  },
  chainId: { type: Number },
  status: {
    type: String,
  },
  receipt: {
    type: Object,
  },
  relayerAddress: {
    type: String,
  },
  walletAddress: {
    type: String,
  },
  metaData: {
    type: Object,
  },
  rawTransaction: {
    type: Object,
  },
  gasPrice: {
    type: String,
  },
  resubmitted: {
    type: Boolean,
    default: false,
  },
  creationTime: {
    type: Number,
    required: true,
  },
  updationTime: {
    type: Number,
  },
});
