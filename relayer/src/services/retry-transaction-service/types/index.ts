import { INetworkService } from '../../../../../common/network';
import { IQueue } from '../../../../../common/queue';
import { RetryTransactionQueueData } from '../../../../../common/queue/types';
import { EVMRawTransactionType } from '../../../../../common/types';
import { IEVMAccount } from '../../account';
import { IRelayerManager } from '../../relayer-manager';
import { ITransactionService } from '../../transaction-service';

export type EVMRetryTransactionServiceParamsType = {
  transactionService: ITransactionService<IEVMAccount, EVMRawTransactionType>,
  networkService: INetworkService<IEVMAccount, EVMRawTransactionType>,
  retryTransactionQueue: IQueue<RetryTransactionQueueData>,
  options: {
    chainId: number,
    EVMRelayerManagerMap: {
      [name: string] : {
        [chainId: number]: IRelayerManager<IEVMAccount, EVMRawTransactionType>;
      }
    }
  },
};
