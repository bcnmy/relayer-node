import { RelayServiceResponseType } from '../../types';

export interface IRelayService<TransactionMessageType> {
  sendTransactionToRelayer(data: TransactionMessageType): Promise<RelayServiceResponseType>;
}
