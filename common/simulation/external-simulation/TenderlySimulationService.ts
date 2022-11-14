import axios from 'axios';
import { ExternalSimulationResponseType, SCWSimulationDataType } from '../types';
import { logger } from '../../log-config';
import { IGasPrice } from '../../gas-price';
import { GasPriceType } from '../../gas-price/types';
import { IExternalSimulation } from '../interface';

const log = logger(module);

export class TenderlySimulationService implements IExternalSimulation {
  gasPriceService: IGasPrice;

  private tenderlyUser: string;

  private tenderlyProject: string;

  private tenderlyAccessKey: string;

  constructor(gasPriceService: IGasPrice, options: {
    tenderlyUser: string,
    tenderlyProject: string,
    tenderlyAccessKey: string,
  }) {
    this.gasPriceService = gasPriceService;
    this.tenderlyUser = options.tenderlyUser;
    this.tenderlyProject = options.tenderlyProject;
    this.tenderlyAccessKey = options.tenderlyAccessKey;
  }

  async simulate(
    simualtionData: SCWSimulationDataType,
  ): Promise<ExternalSimulationResponseType> {
    const {
      chainId, data, to, refundInfo,
    } = simualtionData;
    log.info(`Sending request to tenderly to run simulation for SCW: ${to} with data: ${data}`);
    const SIMULATE_URL = `https://api.tenderly.co/api/v1/account/${this.tenderlyUser}/project/${this.tenderlyProject}/simulate`;
    const tAxios = this.tenderlyInstance();

    const gasPriceForSimulation = await this.gasPriceService.getGasPriceForSimulation();
    log.info(`Gas price to be used in simulation: ${gasPriceForSimulation}`);
    const body = {
      // standard TX fields
      network_id: chainId.toString(),
      from: '0x040a9cbC4453B0eeaE12f3210117B422B890C1ED',
      input: data,
      gas: 8000000,
      gas_price: gasPriceForSimulation.toString(), // TODO get value from cache
      value: '0',
      to,
      // simulation config (tenderly specific)
      save: true,
    };
    let response;
    try {
      response = await tAxios.post(SIMULATE_URL, body);
    } catch (error) {
      log.info(`Error in Tenderly Simulation: ${JSON.stringify(error)}`);
      return {
        isSimulationSuccessful: false,
        msgFromSimulation: `Error in Tenderly Simulation: ${JSON.stringify(error)}`,
        gasLimitFromSimulation: 0,
      };
    }

    if (!response?.data?.transaction?.status) {
      return {
        isSimulationSuccessful: false,
        msgFromSimulation: response?.data?.transaction?.error_message,
        gasLimitFromSimulation: 0,
      };
    }

    const transactionLogs = response.data.transaction.transaction_info.call_trace.logs;
    const gasUsedInSimulation = response.data.transaction.transaction_info.call_trace.gas_used
     + response.data.transaction.transaction_info.call_trace.intrinsic_gas;
    const { isRelayerPaidFully, successOrRevertMsg } = await this.checkIfRelayerIsPaidFully(
      transactionLogs,
      gasUsedInSimulation,
      refundInfo,
      to,
      data,
    );

    log.info(`isRelayerPaidFully: ${isRelayerPaidFully} for SCW: ${to} with data: ${data}`);

    if (!isRelayerPaidFully) {
      return {
        isSimulationSuccessful: false,
        msgFromSimulation: `Payment to relayer is incorrect, with message: ${successOrRevertMsg}`,
        gasLimitFromSimulation: 0,
      };
    }

    return {
      isSimulationSuccessful: true,
      msgFromSimulation: 'Fee options fetched successfully',
      gasLimitFromSimulation: response?.data?.transaction?.gas_used,
    };
  }

  private tenderlyInstance() {
    return axios.create({
      headers: {
        'X-Access-Key': this.tenderlyAccessKey || '',
        'Content-Type': 'application/json',
      },
    });
  }

  private async checkIfRelayerIsPaidFully(
    transactionLogs: any,
    gasUsedInSimulation: number,
    refundInfo: { tokenGasPrice: string, gasToken: string },
    to: string,
    data: string,
  ) {
    try {
      log.info(`Refund info received: ${JSON.stringify(refundInfo)}`);
      log.info(`Checking if relayer is being paid fully for SCW: ${to} with data: ${data}`);
      const walletHandlePaymentLog = transactionLogs.find((transactionLog: any) => transactionLog.name === 'WalletHandlePayment');
      if (!walletHandlePaymentLog) {
        return {
          isRelayerPaidFully: true,
          successOrRevertMsg: 'WalletHandlePayment event not found in simulation logs',
        };
      }

      const paymentEventData = walletHandlePaymentLog.inputs.find((input: any) => input.soltype.name === 'payment');
      if (!paymentEventData) {
        return {
          isRelayerPaidFully: true,
          successOrRevertMsg: 'Payment data not found in ExecutionSuccess simulation logs',
        };
      }
      const paymentValue = paymentEventData.value;
      if (!paymentValue) {
        return {
          isRelayerPaidFully: true,
          successOrRevertMsg: 'Payment value not found in payment event data',
        };
      }
      log.info(`Payment sent in transaction: ${paymentValue} for SCW: ${to} with data: ${data}`);

      let refundToRelayer: number;
      const gasPrice = await this.gasPriceService.getGasPrice(GasPriceType.DEFAULT);
      // TODO // Review how to calculate this
      const nativeTokenGasPrice = parseInt(gasPrice as string, 10);

      log.info(`Native token gas price: ${nativeTokenGasPrice} for SCW: ${to} with data: ${data}`);
      // ERC 20 token gas price should be in units of native asset
      // TODO get price feeds
      const erc20TokenGasPrice = parseInt(refundInfo.tokenGasPrice, 10);
      let refundCalculatedInSimualtion: number = 0;
      if (refundInfo.gasToken === '0x0000000000000000000000000000000000000000') {
        refundToRelayer = Number(paymentValue) * nativeTokenGasPrice;
        refundCalculatedInSimualtion = gasUsedInSimulation * nativeTokenGasPrice;
      } else {
        // decimals
        // paymentValue is in smallest unit?
        refundToRelayer = Number(paymentValue) * erc20TokenGasPrice;
        refundCalculatedInSimualtion = gasUsedInSimulation * erc20TokenGasPrice;
      }

      log.info(`Refund being sent to relayer in the transaction: ${refundToRelayer} for SCW: ${to} with data: ${data}`);
      log.info(`Asset consumption calculated from simulation: ${refundCalculatedInSimualtion} for SCW: ${to} with data: ${data}`);

      if ((Number(refundToRelayer) < Number(refundCalculatedInSimualtion))) {
        return {
          isRelayerPaidFully: true,
          successOrRevertMsg: `Refund to relayer: ${refundToRelayer} is less than what will be consumed in the transaction: ${gasUsedInSimulation * nativeTokenGasPrice}`,
        };
      }
      return {
        isRelayerPaidFully: true,
        successOrRevertMsg: `Refund to relayer: ${refundToRelayer} is sufficient to send the transaction`,
      };
    } catch (error) {
      log.info(error);
      return {
        isRelayerPaidFully: true,
        successOrRevertMsg: `Something went wrong with error: ${error}`,
      };
    }
  }
}
