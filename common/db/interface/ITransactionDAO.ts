import { IBlockchainTransaction } from '../mongo/interface';

export interface ITransactionDAO {
  save(chainId: number, transactionData: object): Promise<void>
  updateByTransactionId(chainId: number, id: string, transactionData: object): Promise<void>
  getByTransactionId(chainId: number, id: string): Promise<IBlockchainTransaction[] | null>
  updateByTransactionIdAndTransactionHash(
    chainId: number,
    id: string,
    hash: string,
    transactionData: object,
  ): Promise<void>
}
