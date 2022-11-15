import Handlebars from 'handlebars';
import { Request, Response } from 'express';
import { statusService } from '../../../../common/service-manager';

Handlebars.registerHelper('eachProperty', (context: any, options: any) => {
  let ret = '';
  // eslint-disable-next-line guard-for-in
  for (const prop in context) {
    ret += options.fn({ property: prop, value: context[prop] });
  }
  return ret;
});

export const status = async (req: Request, res: Response) => {
  // call the service in common to get all the updated status
  const redis = await statusService.checkRedis();
  const mongo = await statusService.checkMongo();
  const relayerManager = await statusService.checkRelayerManager();
  const networkService = await statusService.checkNetworkService();
  const tokenPrice = await statusService.checkTokenPrice();
  res.render('status', {
    redis,
    mongo,
    relayerManager,
    networkService,
    tokenPrice,
  });
};
