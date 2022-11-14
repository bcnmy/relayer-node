import { IQueue } from '../interface';
import { logger } from '../log-config';
import {
  AATransactionMessageType, RelayServiceResponseType,
} from '../types';
import { IRelayService } from './interface/IRelayService';

const log = logger(module);
export class AARelayService implements IRelayService<AATransactionMessageType> {
  queue: IQueue<AATransactionMessageType>;

  constructor(queue: IQueue<AATransactionMessageType>) {
    this.queue = queue;
  }

  async sendTransactionToRelayer(
    data: AATransactionMessageType,
  ): Promise<RelayServiceResponseType> {
    log.info(`Sending transaction to AA tranasction queue with transactionId: ${data.transactionId}`);
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
