import { Router } from 'express';
import { transactionStatusApi, feeOptionsApi, requestHandler } from '../../controllers';
import { simulateTransaction } from '../../controllers/simulate';
import { transactionResubmitApi } from '../../controllers/transaction-resubmit';
import {
  validateRelayRequest,
  validateFeeOption,
  validateTransactionStatus,
  validateTransactionResubmit,
} from '../../middleware';

export const relayApiRouter = Router();

relayApiRouter.get('/feeOptions', validateFeeOption, feeOptionsApi);

relayApiRouter.get('/status', validateTransactionStatus, transactionStatusApi);

relayApiRouter.post('/', validateRelayRequest(), simulateTransaction(), requestHandler);

relayApiRouter.post('/resubmit', validateTransactionResubmit, transactionResubmitApi);
