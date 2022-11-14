import { IQueue } from '../interface';
import { logger } from '../log-config';
import { SCWTransactionMessageType, RelayServiceResponseType } from '../types';
import { IRelayService } from './interface/IRelayService';

const log = logger(module);
export class SCWRelayService implements IRelayService<SCWTransactionMessageType> {
  queue: IQueue<SCWTransactionMessageType>;

  constructor(queue: IQueue<SCWTransactionMessageType>) {
    this.queue = queue;
  }

  async sendTransactionToRelayer(
    data: SCWTransactionMessageType,
  ): Promise<RelayServiceResponseType> {
    log.info(`Sending transaction to SCW tranasction queue with transactionId: ${data.transactionId}`);
    await this.queue.publish(data);
    let response : RelayServiceResponseType;
    try {
      response = {
        code: 200,
        transactionId: data.transactionId,
      };
    } catch (error) {
      response = {
        code: 400,
        error: 'bad request',
      };
    }
    return response;
  }
}
