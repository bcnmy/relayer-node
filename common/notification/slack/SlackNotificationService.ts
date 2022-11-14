import { WebClient } from '@slack/web-api';
import { logger } from '../../log-config';
import { ISlackNotificationService } from '../interface';
import { PostSlackMessageParamsType, SlackNotificationObjectType } from '../types';

const log = logger(module);

export class SlackNotificationService implements ISlackNotificationService {
  web: WebClient;

  slackToken: string;

  slackChannel: string;

  constructor(slackToken: string, slackChannel: string) {
    this.slackToken = slackToken;
    this.slackChannel = slackChannel;
    if (this.slackChannel && this.slackToken) {
      this.web = new WebClient(this.slackToken);
      if (!this.web) {
        throw new Error('Slack web client is not initialized. Check if slack configurations are present');
      }
    } else {
      throw new Error('Slack token or channel name for relayer node is not present in slack configuration');
    }
  }

  /**
     * Method to call if you want to send some notifications to Slack.
     * Input should be in below format
     * {
     *   data: {
     *     text: "Message to be sent in notificaiton",
     *   }
     * }
     *
     * @param {object} input Object containing information on what to send in notificaiton
     * @throws Error is thrown if there's some error while sending notification
     */
  async notify(input: { data: { text: string; }; }): Promise<void> {
    await this.postMessage({
      text: input.data.text,
      channel: this.slackChannel,
    });
  }

  /**
     * Call this method to call Slack API with input data passed in the format
     * {
     *     text: "Message to be sent",
     *     channel: "Channel id of slack channel like C00279KO0QP"
     * }
     * @param {object} postSlackMessageParams Object containing data to be sent in notification
     */
  async postMessage(
    postSlackMessageParams: PostSlackMessageParamsType,
  ): Promise<void> {
    const result = await this.web.chat.postMessage(postSlackMessageParams);
    log.info(result);
    log.info(`Successfully sent message ${postSlackMessageParams.text} to Slack channel with id ${postSlackMessageParams.channel}`);
  }

  /**
     * Static method which returns an object which can be directly sent
     * to Slack API to send the notification.
     *
     * @param {string} text Message to be sent in notification
     */
  getNotifyObject(text: string): SlackNotificationObjectType {
    const slackNotifyObject = {
      data: { text, channel: this.slackChannel },
    };
    return slackNotifyObject;
  }
}
