import { schedule } from 'node-cron';
import { config } from '../../../config';
import { IEVMAccount } from '../../../relayer/src/services/account';
import { ICacheService } from '../../cache';
import { logger } from '../../log-config';
import { INetworkService } from '../../network';
import { IScheduler } from '../../scheduler';
import { EVMRawTransactionType } from '../../types';
import { gasPriceCall } from '../../utils/axios-calls';
import { GasPrice } from '../GasPrice';
import { GasPriceType } from '../types';

const log = logger(module);

export class MaticGasPrice extends GasPrice implements IScheduler {
  updateFrequencyInSeconds: number;

  constructor(
    cacheService: ICacheService,
    networkService: INetworkService<IEVMAccount, EVMRawTransactionType>,
    options: {
      chainId: number,
      EIP1559SupportedNetworks: Array<number>
    },
  ) {
    super(cacheService, networkService, options);
    this.updateFrequencyInSeconds = config.gasPrice[this.chainId].updateFrequencyInSeconds || 60;
  }

  async polygonGasStation() {
    const url = config.gasPrice[this.chainId].gasOracle.polygonscanUrl;
    if (!url) throw new Error('Polygon scan gas station url not provided.');

    const { status, result: response } = await gasPriceCall(url);

    if (status !== '1') throw new Error('invalid response from polygon scan');

    const mediumGasPrice = response.SafeGasPrice;
    const mediumGasPriceInWei = mediumGasPrice * 1e9;

    const fastGasPrice = response.ProposeGasPrice;
    const fastGasPriceInWei = fastGasPrice * 1e9;

    const fastestGasPrice = response.FastGasPrice;
    const fastestGasPriceInWei = fastestGasPrice * 1e9;

    return { mediumGasPriceInWei, fastGasPriceInWei, fastestGasPriceInWei };
  }

  async maticGasStation() {
    const url = config.gasPrice[this.chainId].gasOracle.maticGasStationUrl || '';
    if (!url) throw new Error('Matic gas station url not provided.');

    const response = await gasPriceCall(url);

    const mediumGasPrice = response.standard;
    const mediumGasPriceInWei = mediumGasPrice * 1e9; // gasPrice is in 10 Gwei unit

    const fastGasPrice = response.fast;
    const fastGasPriceInWei = fastGasPrice * 1e9;

    const fastestGasPrice = response.fastest;
    const fastestGasPriceInWei = fastestGasPrice * 1e9;

    log.info(`Medium GasPrice for Polygon from matic gas station is ${mediumGasPrice} gwei`);
    log.info(`Fast GasPrice for Polygon from matic gas station is ${fastGasPrice} gwei`);
    log.info(`Fastest GasPrice for Polygon from matic gas station is ${fastestGasPrice} gwei`);
    return { mediumGasPriceInWei, fastGasPriceInWei, fastestGasPriceInWei };
  }

  async maticGasStationForEIP1559() {
    const url = config.gasPrice[this.chainId].gasOracle.maticGasStationUrlForEIP1559 || '';
    if (!url) throw new Error('Matic gas station url for EIP-1559 not provided.');

    const response = await gasPriceCall(url);

    const safeEIP1559Prices = response.data.safeLow;
    const mediumEIP1559Prices = response.data.standard;
    const fastEIP1559Prices = response.data.fast;
    const { estimatedBaseFee } = response.data;

    const safeMaxPriorityFee = safeEIP1559Prices.maxPriorityFee;
    const safeMaxFee = safeEIP1559Prices.maxFee;
    const mediumMaxPriorityFee = mediumEIP1559Prices.maxPriorityFee;
    const mediumMaxFee = mediumEIP1559Prices.maxFee;
    const fastMaxPriorityFee = fastEIP1559Prices.maxPriorityFee;
    const fastMaxFee = fastEIP1559Prices.maxFee;

    const safeMaxPriorityFeeInWei = safeMaxPriorityFee * 1e9;
    const safeMaxFeeInWei = safeMaxFee * 1e9;
    const mediumMaxPriorityFeeInWei = mediumMaxPriorityFee * 1e9;
    const mediumMaxFeeInWei = mediumMaxFee * 1e9;
    const fastMaxPriorityFeeInWei = fastMaxPriorityFee * 1e9;
    const fastMaxFeeInWei = fastMaxFee * 1e9;
    const estimatedBaseFeeInWei = estimatedBaseFee * 1e9;

    log.info(`Safe Max Priority Fee for Polygon from matic gas station is ${safeMaxPriorityFee} gwei`);
    log.info(`Safe Max Fee for Polygon from matic gas station is ${safeMaxFee} gwei`);
    log.info(`Medium Max Priority Fee for Polygon from matic gas station is ${mediumMaxPriorityFee} gwei`);
    log.info(`Medium Max Fee for Polygon from matic gas station is ${mediumMaxFee} gwei`);
    log.info(`Fast Max Priority Fee for Polygon from matic gas station is ${fastMaxPriorityFee} gwei`);
    log.info(`Fast Max Fee for Polygon from matic gas station is ${fastMaxFee} gwei`);

    log.info(`Estimated Base Fee for Polygon from matic gas station is ${estimatedBaseFee} gwei`);

    const multiplier = config.gasPrice[this.chainId].baseFeeMultiplier
      ? config.gasPrice[this.chainId].baseFeeMultiplier : 1;

    if (safeMaxPriorityFeeInWei
      && safeMaxFeeInWei
      && mediumMaxPriorityFeeInWei
      && mediumMaxFeeInWei
      && fastMaxPriorityFeeInWei
      && fastMaxFeeInWei
      && estimatedBaseFeeInWei) {
      await this.setMaxFeeGasPrice(
        GasPriceType.DEFAULT,
        (safeMaxFeeInWei * multiplier).toString(),
      );
      await this.setMaxPriorityFeeGasPrice(
        GasPriceType.DEFAULT,
        safeMaxPriorityFeeInWei.toString(),
      );

      const lowerLimit = config.gasPrice[this.chainId].minGasPrice;
      let maxPriorityFeeMedium = mediumMaxPriorityFeeInWei;
      let maxFeeMedium;
      if (lowerLimit) {
        if (mediumMaxFeeInWei < lowerLimit) {
          maxFeeMedium = mediumMaxFeeInWei;
        }
        if (maxPriorityFeeMedium < lowerLimit) {
          maxPriorityFeeMedium = lowerLimit;
        }
      }
      maxFeeMedium = (mediumMaxFeeInWei * multiplier).toString();
      maxPriorityFeeMedium *= 1.05;

      log.info(`Polygon mainnet multiplier is ${multiplier}`);
      log.info(`Polygon mainnet maxFeeMedium is ${maxFeeMedium}`);
      log.info(`Polygon mainnet maxPriorityFeeMedium is ${maxPriorityFeeMedium}`);
      await this.setMaxFeeGasPrice(GasPriceType.MEDIUM, maxFeeMedium);

      await this.setMaxPriorityFeeGasPrice(GasPriceType.MEDIUM, maxPriorityFeeMedium.toString());

      await this.setMaxFeeGasPrice(GasPriceType.FAST, (fastMaxFeeInWei * multiplier).toString());

      await this.setMaxPriorityFeeGasPrice(GasPriceType.FAST, fastMaxPriorityFeeInWei.toString());

      const safeMaxFeeGasFromCache = await this.getMaxFeeGasPrice(GasPriceType.DEFAULT);
      log.info(`Polygon Mainnet Safe Max Fee Per Gas From Cache: ${safeMaxFeeGasFromCache}`);

      const mediumMaxFeeGasFromCache = await this.getMaxFeeGasPrice(GasPriceType.MEDIUM);
      log.info(`Polygon Mainnet Medium Max Fee Per Gas From Cache: ${mediumMaxFeeGasFromCache}`);

      const fastMaxFeeGasFromCache = await this.getMaxFeeGasPrice(GasPriceType.FAST);
      log.info(`Polygon Mainnet Fast Max Fee Per Gas From Cache: ${fastMaxFeeGasFromCache}`);

      const safeMaxPriorityFeeGasFromCache = await this.getMaxPriorityFeeGasPrice(
        GasPriceType.DEFAULT,
      );
      log.info(`Polygon Mainnet Safe Max Priority Fee Per Gas From Cache: ${safeMaxPriorityFeeGasFromCache}`);

      const mediumMaxPriorityFeeGasFromCache = await this.getMaxPriorityFeeGasPrice(
        GasPriceType.MEDIUM,
      );
      log.info(`Polygon Mainnet Medium Max Priority Fee Per Gas From Cache: ${mediumMaxPriorityFeeGasFromCache}`);

      const fastMaxPriorityFeeGasFromCache = await this.getMaxPriorityFeeGasPrice(
        GasPriceType.FAST,
      );
      log.info(`Polygon Mainnet Fast Max Priority Fee Per Gas From Cache: ${fastMaxPriorityFeeGasFromCache}`);
    }
  }

  async setup() {
    let response: any;
    try {
      response = await this.maticGasStation().catch(async (err) => {
        log.error('[POLYGONSCAN]', err);
        return this.polygonGasStation();
      });
    } catch (error) {
      log.error('Error in fetching matic gas price from polygonscan and matic gas station.');
    }

    let {
      mediumGasPriceInWei = 20000000000,
      fastGasPriceInWei = 30000000000,
      fastestGasPriceInWei,
    } = response;

    if (config.gasPrice[this.chainId].gasOracle.polygonscanUrl
       && fastGasPriceInWei < config.gasPrice[this.chainId].minGasPrice) {
      fastGasPriceInWei = config.gasPrice[this.chainId].minGasPrice;
      // If fastest gas price is less than 110% of fast gas price, increase the fastest gas price
      // so when its used to bump up gas price, it doesn't end up in "transaction underpriced" error
      if (fastestGasPriceInWei <= (fastGasPriceInWei * 1.1)) {
        // Set fastest gas price to be 11% higher than fast gas price
        fastestGasPriceInWei = (config.gasPrice[this.chainId].minGasPrice) * 1.11;
      }
    }

    const upperLimit = config.gasPrice[this.chainId].maxGasPrice;
    if (upperLimit) {
      if (fastGasPriceInWei > upperLimit) {
        // log.info(`Fast gas price for matic ${fastGasPriceInWei} is more than 500 gwei`)
        fastGasPriceInWei = upperLimit;
      }
      if (fastestGasPriceInWei > upperLimit) {
        // log.info(`Fast gas price for matic ${fastestGasPriceInWei} is more than 500 gwei`)
        fastestGasPriceInWei = upperLimit;
      }
      if (mediumGasPriceInWei > upperLimit) {
        // log.info(`Fast gas price for matic ${mediumGasPriceInWei} is more than 500 gwei`)
        mediumGasPriceInWei = upperLimit;
      }
    }

    await this.setGasPrice(
      GasPriceType.DEFAULT,
      Math.round(fastGasPriceInWei).toString(),
    );
    await this.setGasPrice(
      GasPriceType.MEDIUM,
      Math.round(mediumGasPriceInWei).toString(),
    );
    await this.setGasPrice(
      GasPriceType.FAST,
      Math.round(fastestGasPriceInWei).toString(),
    );
  }

  schedule() {
    schedule(`*/${this.updateFrequencyInSeconds} * * * * *`, () => {
      this.setup();
    });
  }
}
