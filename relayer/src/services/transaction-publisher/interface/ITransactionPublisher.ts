import { IQueue } from '../../../../../common/interface';
import { RetryTransactionQueueData } from '../../../../../common/queue/types';

export interface ITransactionPublisher<TransactionMessageType> {
  transactionQueue: IQueue<TransactionMessageType>;

  retryTransactionQueue: IQueue<RetryTransactionQueueData>;

  publishToTransactionQueue(data: TransactionMessageType): Promise<boolean>;
  publishToRetryTransactionQueue(data: RetryTransactionQueueData): Promise<boolean>;
}
