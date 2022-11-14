import { Request } from 'express';
import { logger } from '../../../../common/log-config';
import { scwSimulationServiceMap } from '../../../../common/service-manager';

const log = logger(module);

export const simulateSCWTransaction = async (req: Request) => {
  try {
    const {
      to, data, chainId, refundInfo,
    } = req.body.params[0];

    const scwSimulationResponse = await scwSimulationServiceMap[chainId].simulate({
      to,
      data,
      chainId,
      refundInfo,
    });

    if (!scwSimulationResponse.isSimulationSuccessful) {
      const { msgFromSimulation } = scwSimulationResponse;
      return {
        code: 400,
        msgFromSimulation,
      };
    }
    const { gasLimitFromSimulation } = scwSimulationResponse;
    req.body.params[1] = gasLimitFromSimulation;
    log.info(`Transaction successfully simulated for SCW: ${to} on chainId: ${chainId}`);
    return {
      code: 200,
      msgFromSimulation: 'Transaction successfully simulated',
    };
  } catch (error) {
    log.error(`Error in SCW simulation ${error}`);
    return {
      code: 500,
      error,
    };
  }
};
