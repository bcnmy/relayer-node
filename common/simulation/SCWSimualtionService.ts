import { IEVMAccount } from '../../relayer/src/services/account';
import { INetworkService } from '../network';
import { EVMRawTransactionType } from '../types';
import { TenderlySimulationService } from './external-simulation';
import { SCWSimulationDataType, SimulationResponseType } from './types';

export class SCWSimulationService {
  networkService: INetworkService<IEVMAccount, EVMRawTransactionType>;

  tenderlySimulationService: TenderlySimulationService;

  constructor(
    networkService: INetworkService<IEVMAccount, EVMRawTransactionType>,
    tenderlySimulationService: TenderlySimulationService,
  ) {
    this.networkService = networkService;
    this.tenderlySimulationService = tenderlySimulationService;
  }

  async simulate(simulationData: SCWSimulationDataType): Promise<SimulationResponseType> {
    const tenderlySimulationResult = await this.tenderlySimulationService.simulate(simulationData);
    return tenderlySimulationResult;
  }
}
