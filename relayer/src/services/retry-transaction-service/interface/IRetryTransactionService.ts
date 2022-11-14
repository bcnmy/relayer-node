import { INetworkService } from '../../../../../common/network';
import { IConsumer } from '../../consumer/interface/IConsumer';
import { ITransactionService } from '../../transaction-service/interface/ITransactionService';

export interface IRetryTransactionService<AccountType, RawTransactionType>
  extends IConsumer {
  transactionService: ITransactionService<AccountType, RawTransactionType>;
  networkService: INetworkService<AccountType, RawTransactionType>;
}
