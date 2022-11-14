import { Request, Response } from 'express';
import { logger } from '../../../../common/log-config';
import { transactionDao } from '../../../../common/service-manager';
import { parseError } from '../../../../common/utils';

const log = logger(module);

export const transactionStatusApi = async (req: Request, res: Response) => {
  const chainIdInStr = req.query.chainId as string;
  const chainId = parseInt(chainIdInStr, 10);
  const transactionId = req.query.transactionId as string;
  const response = await transactionDao.getByTransactionId(chainId, transactionId);
  log.info(`Transaction status for transactionId ${transactionId} on chainId ${chainId} is ${JSON.stringify(response)}`);
  try {
    if (!response) {
      log.info(`Transaction status for transactionId ${transactionId} on chainId ${chainId} is not found`);
      return res.status(404).json({
        code: 404,
        error: 'Transaction not found',
      });
    }
    log.info(`Transaction status for transactionId ${transactionId} on chainId ${chainId} is ${JSON.stringify(response)}`);
    if (response.length) {
      return res.json({
        code: 200,
        data: {
          chainId,
          transactionId: response[0].transactionId,
          status: response[0].status,
          transactionHash: response[0].transactionHash,
          gasPrice: response[0].gasPrice,
          receipt: response[0].receipt,
          previousTransactionHash: response.length > 1 ? response[0].previousTransactionHash : null,
        },
      });
    }
    return res.status(404).json({
      code: 404,
      error: 'Transaction not found',
    });
  } catch (error) {
    log.error(`Error in transaction status ${parseError(error)}`);
    return res.status(500).json({
      code: 500,
      error: parseError(error),
    });
  }
};
