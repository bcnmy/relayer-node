import { ICacheService } from '../../../../../common/cache';
import { IRelayerManager } from '../../relayer-manager';
import { ITransactionService } from '../../transaction-service';
import { IConsumer } from './IConsumer';

export interface ITransactionConsumer<AccountType, RawTransactionType>
  extends IConsumer {
  relayerManager: IRelayerManager<AccountType, RawTransactionType>;
  transactionService: ITransactionService<AccountType, RawTransactionType>;
  cacheService: ICacheService,
}
