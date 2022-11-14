import { Request, Response } from 'express';
import { logger } from '../../../../common/log-config';
import { feeOptionMap } from '../../../../common/service-manager';

const log = logger(module);

export const feeOptionsApi = async (req: Request, res: Response) => {
  const chainId = req.query.chainId as string;
  const response = await feeOptionMap[Number(chainId)].get();
  try {
    if (response.error) {
      return res.status(400).json({
        code: 400,
        error: response.error,
      });
    }
    return res.json({
      code: 200,
      data: {
        chainId,
        ...response,
      },
    });
  } catch (error) {
    log.error(`Error in fee option ${error}`);
    return res.status(500).json({
      code: 500,
      error,
    });
  }
};
