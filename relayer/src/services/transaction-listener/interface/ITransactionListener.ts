import { ICacheService } from '../../../../../common/cache';
import { ITransactionDAO } from '../../../../../common/db';
import { IQueue } from '../../../../../common/interface';
import { INetworkService } from '../../../../../common/network';
import { RetryTransactionQueueData } from '../../../../../common/queue/types';
import { TransactionQueueMessageType } from '../../../../../common/types';
import { NotifyTransactionListenerParamsType, TransactionListenerNotifyReturnType } from '../types';

export interface ITransactionListener<AccountType, RawTransactionType> {
  chainId: number;
  networkService: INetworkService<AccountType, RawTransactionType>;
  transactionDao: ITransactionDAO;
  transactionQueue: IQueue<TransactionQueueMessageType>;
  retryTransactionQueue: IQueue<RetryTransactionQueueData>;
  cacheService: ICacheService;

  notify(notifyTransactionListenerParams: NotifyTransactionListenerParamsType):
  Promise<TransactionListenerNotifyReturnType>
}
