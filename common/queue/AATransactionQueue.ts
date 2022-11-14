import amqp, { Channel, ConsumeMessage, Replies } from 'amqplib';
import { config } from '../../config';
import { logger } from '../log-config';
import { AATransactionMessageType, TransactionType } from '../types';
import { IQueue } from './interface/IQueue';

const log = logger(module);

const { queueUrl } = config;

export class AATransactionQueue implements IQueue<AATransactionMessageType> {
  private channel!: Channel;

  transactionType: TransactionType = TransactionType.AA;

  private exchangeName = `relayer_queue_exchange_${this.transactionType}`;

  private exchangeType = 'direct';

  chainId: number;

  queueName: string;

  msg!: ConsumeMessage | null;

  constructor(
    options: {
      chainId: number,
    },
  ) {
    this.chainId = options.chainId;
    this.queueName = `relayer_queue_${this.transactionType}_${this.chainId}`;
  }

  async connect() {
    const connection = await amqp.connect(queueUrl);
    if (!this.channel) {
      this.channel = await connection.createChannel();
      this.channel.assertExchange(this.exchangeName, this.exchangeType, {
        durable: true,
      });
    }
  }

  async publish(data: AATransactionMessageType) {
    const key = `chainid.${this.chainId}.type.${this.transactionType}`;
    log.info(`Publishing data to retry queue on chainId: ${this.chainId} and key ${key}`);
    this.channel.publish(this.exchangeName, key, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
    return true;
  }

  async consume(onMessageReceived: () => void) {
    log.info(`[x] Setting up consumer for queue with chainId: ${this.chainId} for transaction type ${this.transactionType}`);
    this.channel.prefetch(1);
    try {
      // setup a consumer
      const queue: Replies.AssertQueue = await this.channel.assertQueue(`relayer_queue_${this.chainId}_type_${this.transactionType}`);
      const key = `chainid.${this.chainId}.type.${this.transactionType}`;
      log.info(`[*] Waiting for transactions on chaindId: ${this.chainId} for transaction type ${this.transactionType}`);
      this.channel.bindQueue(queue.queue, this.exchangeName, key);
      await this.channel.consume(
        queue.queue,
        onMessageReceived,
      );

      return true;
    } catch (error) {
      log.error(error);
      return false;
    }
  }

  async ack(data: ConsumeMessage) {
    this.channel.ack(data);
  }
}
