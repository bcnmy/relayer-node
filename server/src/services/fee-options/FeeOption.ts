/* eslint-disable no-await-in-loop */
import Big from 'big.js';
import { ICacheService } from '../../../../common/cache';
import { IGasPrice } from '../../../../common/gas-price';
import { GasPriceType } from '../../../../common/gas-price/types';
import { logger } from '../../../../common/log-config';
import { getTokenPriceKey } from '../../../../common/utils';
import { config } from '../../../../config';
import { FeeOptionResponseType } from './types';

const log = logger(module);

const convertGasPriceToUSD = async (
  nativeChainId: number,
  gasPrice: number,
  chainPriceDataInUSD: number,
  token: string,
) => {
  log.info(`Converting gas price to USD for chain ${nativeChainId} and token ${token} with gas price ${gasPrice} and chain price data in USD ${chainPriceDataInUSD}`);
  const decimal = config.chains.decimal[nativeChainId] || 18;
  const offset = config.feeOption.offset[nativeChainId][token] || 1;
  const usdc = new Big(gasPrice)
    .mul(new Big(chainPriceDataInUSD))
    .div(new Big(10 ** decimal))
    .mul(new Big(offset))
    .toString();
  return usdc;
};

export class FeeOption {
  chainId: number;

  gasPriceService: IGasPrice;

  cacheService: ICacheService;

  constructor(
    gasPriceService: IGasPrice,
    cacheService: ICacheService,
    options: {
      chainId: number,
    },
  ) {
    this.cacheService = cacheService;
    this.gasPriceService = gasPriceService;
    this.chainId = options.chainId;
  }

  private static getNetworkPriceDataKey() {
    return 'NETWORK_PRICE_DATA';
  }

  async get() {
    try {
      const response: Array<FeeOptionResponseType> = [];
      const feeTokens = config.feeOption.supportedFeeTokens[this.chainId] || [];
      const gasPriceInString = await this.gasPriceService.getGasPrice(
        GasPriceType.DEFAULT,
      );

      // TODO // Check for EIP 1559
      const gasPrice = Number(gasPriceInString);

      const networkPriceDataInString = await this.cacheService.get(
        getTokenPriceKey(),
      );
      let networkPriceData;
      if (!networkPriceDataInString) {
        // 5, 80001, 97, 420, 421613, 43113
        networkPriceData = {
          1: '1278.43', 5: '1278.43', 80001: '0.80', 97: '289.87', 420: '1278.43', 421613: '1278.43', 43113: '13.17',
        };
      } else {
        networkPriceData = JSON.parse(networkPriceDataInString);
      }
      const chainPriceDataInUSD = networkPriceData[this.chainId];

      for (const token of feeTokens) {
        let tokenGasPrice;
        const decimal = config.feeOption.decimals[this.chainId][token];
        // get similar or wrapped token
        if (config.feeOption.similarTokens[this.chainId].includes(token)) {
          tokenGasPrice = gasPrice;
        } else if (token === 'USDC' || token === 'USDT' || token === 'DAI') { // stables
          tokenGasPrice = await convertGasPriceToUSD(
            this.chainId,
            gasPrice,
            chainPriceDataInUSD,
            token,
          );
          log.info(`Token gas price in usd for chain ${this.chainId} and token ${token} is ${tokenGasPrice} before multiply by 10^${decimal}`);
          tokenGasPrice = new Big(tokenGasPrice).mul(10 ** decimal).toFixed(0).toString();
        } else {
        // calculate for cross chain
          const nativeChainId = config.feeOption.nativeChainIds[token];
          log.info(`Native chain id for token ${token} is ${nativeChainId}`);
          if (nativeChainId) {
            const gasPriceInUSD = await convertGasPriceToUSD(
              this.chainId,
              gasPrice,
              chainPriceDataInUSD,
              token,
            );
            log.info(`Token gas price in usd for chain ${this.chainId} and token ${token} is ${gasPriceInUSD} before multiply by 10^${decimal}`);
            const nativeChainPrice = networkPriceData[nativeChainId];
            log.info(`Native chain price for chain ${nativeChainId} is ${nativeChainPrice}`);
            tokenGasPrice = new Big(gasPriceInUSD).div(new Big(nativeChainPrice));
            log.info(`Token gas price is ${tokenGasPrice} after dividing by native chain price`);
            tokenGasPrice = new Big(tokenGasPrice).mul(10 ** decimal).toFixed(0).toString();
            log.info(`Final token gas price is ${tokenGasPrice} after multiplying by 10^${decimal}`);
          }
        }
        response.push({
          tokenGasPrice: Number(tokenGasPrice),
          symbol: token,
          decimal,
          offset: config.feeOption.offset[this.chainId][token] || 1,
          address: config.feeOption.tokenContractAddress[this.chainId][token],
          logoUrl: config.feeOption.logoUrl[this.chainId][token],
          feeTokenTransferGas: config.feeOption.feeTokenTransferGas[this.chainId][token],
          refundReceiver: config.feeOption.refundReceiver[this.chainId],
          commission: config.feeOption.commission[this.chainId] || 0,
        });
      }
      return {
        code: 200,
        response,
      };
    } catch (error) {
      console.log(error);
      log.error(error);
      return {
        code: 500,
        error: `Error occured in getting fee options service. Error: ${error}`,
      };
    }
  }
}
