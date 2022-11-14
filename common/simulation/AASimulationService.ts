import { BigNumber } from 'ethers';
import { config } from '../../config';
import { IEVMAccount } from '../../relayer/src/services/account';
import { logger } from '../log-config';
import { INetworkService } from '../network';
import { EVMRawTransactionType } from '../types';
import { parseError } from '../utils';
import { AASimulationDataType, SimulationResponseType } from './types';

const log = logger(module);
export class AASimulationService {
  networkService: INetworkService<IEVMAccount, EVMRawTransactionType>;

  constructor(
    networkService: INetworkService<IEVMAccount, EVMRawTransactionType>,
  ) {
    this.networkService = networkService;
  }

  async simulate(
    simulationData: AASimulationDataType,
  ): Promise<SimulationResponseType> {
    // entry point contract call to check
    // https://github.com/eth-infinitism/account-abstraction/blob/5b7130c2645cbba7fe4540a96997163b44c1aafd/contracts/core/EntryPoint.sol#L245
    const { userOp, entryPointContract, chainId } = simulationData;
    const entryPointStatic = entryPointContract.connect(
      this.networkService.ethersProvider.getSigner(config.zeroAddress),
    );

    let isSimulationSuccessful = true;
    try {
      await entryPointStatic.callStatic.simulateValidation(userOp, false);
    } catch (error: any) {
      log.info(`AA Simulation failed: ${JSON.stringify(error)}`);
      isSimulationSuccessful = false;
      return {
        isSimulationSuccessful,
        gasLimitFromSimulation: 0,
        msgFromSimulation: JSON.stringify(error),
      };
    }

    const estimatedGasForUserOpFromEthers = await this.networkService.estimateGas(
      entryPointContract,
      'handleOps',
      [[userOp],
        config.feeOption.refundReceiver[chainId]],
      config.zeroAddress,
    );
    const estimatedGasForUserOp = BigNumber.from('1000000');

    log.info(`Estimated gas is: ${estimatedGasForUserOpFromEthers} from ethers for userOp: ${JSON.stringify(userOp)}`);
    if (!estimatedGasForUserOp._isBigNumber) {
      return {
        isSimulationSuccessful: false,
        gasLimitFromSimulation: 0,
        msgFromSimulation: parseError(estimatedGasForUserOp),
      };
    }
    return {
      isSimulationSuccessful,
      gasLimitFromSimulation: estimatedGasForUserOp,
      msgFromSimulation: 'Success',
    };
  }
}
