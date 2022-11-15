import { INotificationManager, ISlackNotificationService } from './interface';
import { SlackNotificationDataType, SlackNotificationObjectType } from './types';

export class NotificationManager implements INotificationManager {
  slackNotificationService: ISlackNotificationService;

  constructor(slackNotificationService: ISlackNotificationService) {
    this.slackNotificationService = slackNotificationService;
  }

  async sendSlackNotification(slackNotificationData: SlackNotificationDataType) {
    await this.slackNotificationService.notify({
      data: slackNotificationData.data,
    });
  }

  getSlackNotifyObject(text: string): SlackNotificationObjectType {
    return this.slackNotificationService.getNotifyObject(text);
  }
}
