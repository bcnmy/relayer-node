import { NextFunction, Request, Response } from 'express';
import { logger } from '../../../../common/log-config';
import { transactionStatusSchema } from '../../routes/relay/relay.schema';

const log = logger(module);

export const validateTransactionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { error } = transactionStatusSchema.validate(req.query);
    const valid = error == null;

    if (valid) {
      return next();
    }
    const { details } = error;
    const message = details.map((i) => i.message).join(',');
    return res.status(422).json({
      code: 422,
      error: message,
    });
  } catch (e: any) {
    log.error(e);
    return res.status(400).send({
      code: 400,
      error: e.errors,
    });
  }
};
