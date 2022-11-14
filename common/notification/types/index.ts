export type SlackNotificationDataType = SlackNotificationObjectType;

export type PostSlackMessageParamsType = {
  text: string,
  channel: string
};

export type SlackNotificationObjectType = {
  data: PostSlackMessageParamsType
};
