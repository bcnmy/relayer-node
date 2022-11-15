import { EVMRawTransactionType } from '../../../../../common/types';
import { IAccount } from './IAccount';

export interface IEVMAccount extends IAccount {
  getPublicKey(): string;
  signMessage(message: string): Promise<string>;
  signTransaction(rawTransaction: EVMRawTransactionType): Promise<string>
}
