import * as ethers from 'ethers';
import { BigNumber } from 'ethers';
import { IEVMAccount } from '../../relayer/src/services/account';
import { ICacheService } from '../cache';
import { logger } from '../log-config';
import { INetworkService } from '../network';
import { EVMRawTransactionType, NetworkBasedGasPriceType } from '../types';
import { IGasPrice } from './interface/IGasPrice';
import { GasPriceType } from './types';

const log = logger(module);
export class GasPrice implements IGasPrice {
  chainId: number;

  networkService: INetworkService<IEVMAccount, EVMRawTransactionType>;

  cacheService: ICacheService;

  EIP1559SupportedNetworks: Array<number>;

  constructor(
    cacheService: ICacheService,
    networkService: INetworkService<IEVMAccount, EVMRawTransactionType>,
    options: {
      chainId: number,
      EIP1559SupportedNetworks: Array<number>
    },
  ) {
    this.chainId = options.chainId;
    this.EIP1559SupportedNetworks = options.EIP1559SupportedNetworks;
    this.networkService = networkService;
    this.cacheService = cacheService;
  }

  /**
   * Method returns cache key for getting standard gas price from cache
   * @param gasType DEFAULT | MEDIUM | FAST
   * @returns cache key
   */
  private getGasPriceKey = (gasType: GasPriceType) => `GasPrice_${this.chainId}_${gasType}`;

  /**
   * Method returns cache key for getting EIP 1559 max fee per gas from cache
   * @param gasType DEFAULT | MEDIUM | FAST
   * @returns cache key
   */
  private getMaxFeePerGasKey = (gasType: GasPriceType) => `MaxFeeGas_${this.chainId}_${gasType}`;

  /**
   * Method returns cache key for getting EIP 1559 max priority fee per gas from cache
   * @param gasType DEFAULT | MEDIUM | FAST
   * @returns cache key
   */
  private getMaxPriorityFeeGasKey = (gasType: GasPriceType) => `MaxPriorityFeeGas_${this.chainId}_${gasType}`;

  /**
   * Method sets gas price (standard & EIP 1559) in cache
   * @param gasType DEFAULT | MEDIUM | FAST
   * @param price the gas price
   */
  async setGasPrice(gasType: GasPriceType, price: NetworkBasedGasPriceType) {
    if (typeof price === 'string') {
      await this.cacheService.set(this.getGasPriceKey(gasType), price);
    } else {
      await this.cacheService.set(this.getMaxFeePerGasKey(gasType), price.maxFeePerGas);
      await this.cacheService.set(
        this.getMaxPriorityFeeGasKey(gasType),
        price.maxPriorityFeePerGas,
      );
    }
  }

  /**
   * Method gets standard gas price or EIP 1559 gas price
   * @param gasType DEFAULT | MEDIUM | FAST
   * @returns the gas price
   */
  async getGasPrice(gasType = GasPriceType.DEFAULT): Promise<NetworkBasedGasPriceType> {
    let result: NetworkBasedGasPriceType;
    if (this.EIP1559SupportedNetworks.includes(this.chainId)) {
      const maxFeePerGas = await this.getMaxFeeGasPrice(gasType);
      const maxPriorityFeePerGas = await this.getMaxPriorityFeeGasPrice(gasType);
      if (!maxFeePerGas || !maxPriorityFeePerGas) {
        result = await this.networkService.getEIP1559GasPrice();
      } else {
        result = {
          maxFeePerGas,
          maxPriorityFeePerGas,
        };
      }
    } else {
      const gasPrice = await this.cacheService.get(this.getGasPriceKey(gasType));
      if (!gasPrice) {
        const response = await this.networkService.getGasPrice();
        result = response.gasPrice;
      } else {
        result = gasPrice;
      }
    }
    return result;
  }

  /**
   * Method used by Tenderly Simulation call
   * @param gasType Set to DEFAULT
   * @returns gas price
   */
  async getGasPriceForSimulation(gasType = GasPriceType.DEFAULT): Promise<string> {
    let result: string;
    const gasPrice = await this.cacheService.get(this.getGasPriceKey(gasType));
    if (!gasPrice) {
      const response = await this.networkService.getGasPrice();
      result = response.gasPrice;
    } else {
      result = gasPrice;
    }
    return result;
  }

  /**
   * Method gives bumped up gas price in case of resubmitted transaction
   * @param pastGasPrice gas price of original transaction
   * @param bumpingPercentage how much to bump by
   * @returns new bumped up transaction
   */
  getBumpedUpGasPrice(
    pastGasPrice: NetworkBasedGasPriceType,
    bumpingPercentage: number,
  ): NetworkBasedGasPriceType {
    let result;
    if (this.EIP1559SupportedNetworks.includes(this.chainId) && (typeof pastGasPrice === 'object')) {
      let resubmitMaxFeePerGas: number;
      let resubmitMaxPriorityFeePerGas: number;
      const { maxPriorityFeePerGas, maxFeePerGas } = pastGasPrice;
      const pastMaxPriorityFeePerGas = maxPriorityFeePerGas;
      const pastMaxFeePerGas = maxFeePerGas;

      const bumpedUpMaxPriorityFeePerGas = ethers.utils.hexValue(
        BigNumber.from(maxPriorityFeePerGas)
          .mul(bumpingPercentage + 100)
          .div(100),
      );

      const bumpedUpMaxFeePerGas = ethers.utils.hexValue(
        BigNumber.from(pastMaxFeePerGas)
          .mul(bumpingPercentage + 100)
          .div(100),
      );

      if (
        Number(bumpedUpMaxPriorityFeePerGas)
         < Number(pastMaxPriorityFeePerGas) * 1.11) {
        resubmitMaxPriorityFeePerGas = Number(pastMaxPriorityFeePerGas) * 1.11;
      } else {
        resubmitMaxPriorityFeePerGas = Number(pastMaxPriorityFeePerGas);
      }

      if (
        Number(bumpedUpMaxFeePerGas)
         < Number(pastMaxFeePerGas) * 1.11) {
        resubmitMaxFeePerGas = Number(pastMaxFeePerGas) * 1.11;
      } else {
        resubmitMaxFeePerGas = Number(pastMaxFeePerGas);
      }

      result = {
        maxFeePerGas: ethers.BigNumber.from(resubmitMaxPriorityFeePerGas.toString()).toHexString(),
        maxPriorityFeePerGas: ethers.BigNumber.from(resubmitMaxFeePerGas.toString()).toHexString(),
      };
    }
    let resubmitGasPrice: number;

    const bumpedUpPrice = ethers.utils.hexValue(
      BigNumber.from(pastGasPrice)
        .mul(bumpingPercentage + 100)
        .div(100),
    );
    if (
      Number(bumpedUpPrice)
           < 1.1 * Number(pastGasPrice)
    ) {
      resubmitGasPrice = 1.1 * Number(pastGasPrice);
    } else {
      resubmitGasPrice = Number(bumpedUpPrice);
    }

    result = ethers.BigNumber.from(resubmitGasPrice.toString()).toHexString();
    return result;
  }

  /**
   * Method sets EIP 1559 max fee gas
   * @param gasType DEFAULT | MEDIUM | FAST
   * @param price price of max fee gas
   */
  async setMaxFeeGasPrice(gasType: GasPriceType, price: string) {
    await this.cacheService.set(this.getMaxFeePerGasKey(gasType), price);
  }

  /**
   * Method gets EIP 1559 max fee gas
   * @param gasType DEFAULT | MEDIUM | FAST
   * @returns price of max fee gas
   */
  async getMaxFeeGasPrice(gasType: GasPriceType): Promise<string> {
    const result = await this.cacheService.get(this.getMaxFeePerGasKey(gasType));
    return result;
  }

  /**
   * Method gets EIP 1559 max priority fee gas
   * @param gasType DEFAULT | MEDIUM | FAST
   * @returns price of max priority fee gas
   */
  async getMaxPriorityFeeGasPrice(gasType: GasPriceType): Promise<string> {
    const result = await this.cacheService.get(this.getMaxPriorityFeeGasKey(gasType));
    return result;
  }

  /**
   * Method sets EIP 1559 max priority fee gas
   * @param gasType DEFAULT | MEDIUM | FAST
   * @param price price of max priority fee gas
   */
  async setMaxPriorityFeeGasPrice(gasType: GasPriceType, price: string) {
    await this.cacheService.set(this.getMaxPriorityFeeGasKey(gasType), price);
  }

  /**
   * Method sets up gas price manager
   * @param gP the gas price to set
   */
  async setup(gP?: string) {
    try {
      if (!this.networkService) {
        throw new Error('network instance not available');
      }
      let gasPrice: string = gP || '';
      if (!gP) {
        const gasPriceFromNetwork = (await this.networkService.getGasPrice()).gasPrice;
        if (gasPriceFromNetwork) {
          gasPrice = ethers.ethers.utils.isHexString(gasPriceFromNetwork)
            ? parseInt(gasPriceFromNetwork, 16).toString()
            : '';
        }
      }
      await this.setGasPrice(GasPriceType.DEFAULT, gasPrice);

      log.info(`Setting gas price for chaindId: ${this.chainId} as ${gasPrice}`);
    } catch (error) {
      log.info(`Error in setting gas price for network id ${this.chainId} - ${error}`);
    }
  }
}
