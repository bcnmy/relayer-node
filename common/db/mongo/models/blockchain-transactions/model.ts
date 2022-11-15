import mongoose from 'mongoose';
import { config } from '../../../../../config';
import { IBlockchainTransaction } from '../../interface/IBlockchainTransaction';
import { BlockchainTransactionSchema } from './schema';

const { supportedNetworks } = config;

export type BlockchainTransactionsMapType = {
  [networkId: number]: mongoose.Model<IBlockchainTransaction, {}, {}, {}>;
};

const BlockchainTransactionsMap: BlockchainTransactionsMapType = {};

for (const networkId of supportedNetworks) {
  const collectionName = `BlockchainTransactions_${networkId}`;
  BlockchainTransactionsMap[networkId] = mongoose.model(
    collectionName,
    BlockchainTransactionSchema,
  );
}

export { BlockchainTransactionsMap };
