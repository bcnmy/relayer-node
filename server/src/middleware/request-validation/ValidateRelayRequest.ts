import { NextFunction, Request, Response } from 'express';
import { logger } from '../../../../common/log-config';
import { TransactionMethodType } from '../../../../common/types';
import { aaRequestSchema, crossChainRequestSchema, scwRequestSchema } from '../../routes/relay/relay.schema';

const log = logger(module);

export const validateRelayRequest = () => async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { method } = req.body;
    let validationResponse;
    switch (method) {
      case TransactionMethodType.SCW:
        validationResponse = scwRequestSchema.validate(req.body);
        break;
      case TransactionMethodType.AA:
        validationResponse = aaRequestSchema.validate(req.body);
        break;
      case TransactionMethodType.CROSS_CHAIN:
        validationResponse = crossChainRequestSchema.validate(req.body);
        break;
      default:
        return res.status(400).send({
          code: 400,
          error: 'Wrong transaction type sent in validate relay request',
        });
    }
    const { error } = validationResponse;
    const valid = error == null;
    if (valid) {
      return next();
    }
    const { details } = error;
    let message;
    if (details) {
      message = details.map((i) => i.message).join(',');
    } else {
      message = error.message || error.toString();
    }
    return res.status(400).json({
      code: 400,
      error: message,
    });
  } catch (e: any) {
    log.error(e);
    return res.status(400).send({
      code: 400,
      error: JSON.stringify(e),
    });
  }
};
