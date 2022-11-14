import { ethers } from 'ethers';
import { EVMRawTransactionType } from '../../../../common/types';
import { IEVMAccount } from './interface/IEVMAccount';

export class EVMAccount implements IEVMAccount {
  private signer: ethers.Signer;

  private publicKey: string;

  constructor(accountPublicKey: string, accountPrivateKey: string) {
    this.signer = new ethers.Wallet(accountPrivateKey);
    this.publicKey = accountPublicKey;
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  signMessage(message: string): Promise<string> {
    return this.signer.signMessage(message);
  }

  signTransaction(rawTransaction: EVMRawTransactionType): Promise<string> {
    return this.signer.signTransaction(rawTransaction);
  }
}
