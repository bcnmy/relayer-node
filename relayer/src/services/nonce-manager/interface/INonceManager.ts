import { ICacheService } from '../../../../../common/cache';
import { INetworkService } from '../../../../../common/network';

export interface INonceManager<AccountType, RawTransactionType> {
  chainId: number;
  networkService: INetworkService<AccountType, RawTransactionType>;
  cacheService: ICacheService;

  getNonce(address: string, pendingCount?: boolean): Promise<number>;
  markUsed(address: string, nonce: number): Promise<void>;
  incrementNonce(address: string): Promise<boolean>;
}
