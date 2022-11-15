import { IEVMAccount } from '../../relayer/src/services/account';
import { TransactionType } from '../types';

const getMessage = (level: string, message: any, details: any, action: any) => `Level: ${level} \n Message: ${message}\n\nDETAILS\n${details}\n\nAction Required: ${action}`;

const getInfoMessage = (message: string, details: string, action: string | undefined) => getMessage('INFO', message, details, action || 'None');

export const getMaxRetryCountNotificationMessage = (
  transactionId: string,
  account: IEVMAccount,
  transactionType: TransactionType,
  chainId: number,
) => {
  const message = 'Transaction Max retry Count Exceeded';
  const details = `TransactionId: ${transactionId}\n has exceeded max retry count.\nRelayer Address: ${account.getPublicKey()}\nTransaction Type: ${transactionType}\nChain Id: ${chainId}`;
  return getInfoMessage(message, details, undefined);
};
