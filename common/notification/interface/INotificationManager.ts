import { SlackNotificationDataType, SlackNotificationObjectType } from '../types';
import { ISlackNotificationService } from './ISlackNotificationService';

export interface INotificationManager {
  slackNotificationService: ISlackNotificationService;

  sendSlackNotification(slackNotificationData: SlackNotificationDataType): Promise<void>;
  getSlackNotifyObject(text: string): SlackNotificationObjectType;
}
