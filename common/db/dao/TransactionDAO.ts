import { ITransactionDAO } from '../interface';
import { Mongo, IBlockchainTransaction } from '../mongo';

export class TransactionDAO implements ITransactionDAO {
  private _db: Mongo;

  constructor() {
    this._db = Mongo.getInstance();
  }

  /**
   * Method saves transaction data for a given chain id
   * @param chainId
   * @param transactionData
   */
  async save(chainId: number, transactionData: object): Promise<void> {
    await this._db.getBlockchainTransaction(chainId).insertMany([transactionData]);
  }

  /**
   * Method updates an existing entry with some new data
   * @param chainId
   * @param id is transactionId
   * @param data
   */
  async updateByTransactionId(
    chainId: number,
    id: string,
    data: IBlockchainTransaction,
  ): Promise<void> {
    await this._db.getBlockchainTransaction(chainId).updateOne({
      transactionId: id,
    }, data);
  }

  /**
   * Method gets transaction data by transaction id
   * @param chainId
   * @param id is transactionId
   * @returns
   */
  async getByTransactionId(chainId: number, id: string): Promise<IBlockchainTransaction[] | null> {
    const data = await this._db.getBlockchainTransaction(chainId).find({
      transactionId: id,
    }).sort({ _id: -1 }).lean();
    if (data) {
      return data;
    }
    return null;
  }

  async updateByTransactionIdAndTransactionHash(
    chainId: number,
    id: string,
    hash: string,
    data: object,
  ): Promise<void> {
    await this._db.getBlockchainTransaction(chainId).updateOne({
      transactionId: id,
      transactionHash: hash,
    }, data);
  }
}
