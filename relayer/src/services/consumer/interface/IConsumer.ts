import { ConsumeMessage } from 'amqplib';

export interface IConsumer {
  chainId: number;

  onMessageReceived: (msg: ConsumeMessage) => Promise<void>;
}
