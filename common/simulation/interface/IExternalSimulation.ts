import { IGasPrice } from '../../gas-price';

export interface IExternalSimulation {
  gasPriceService: IGasPrice;

  simulate(simulationData: any): Promise<any>;
}
