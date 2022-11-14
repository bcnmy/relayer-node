/* eslint-disable no-await-in-loop */
import Big from 'big.js';
import { config } from '../../../../config';
import { GasPriceType } from '../../../../common/gas-price/types';
import { FeeOptionResponseType } from './types';
import { IGasPrice } from '../../../../common/gas-price';
import { ICacheService } from '../../../../common/cache';
import { logger } from '../../../../common/log-config';

const log = logger(module);

const convertGasPriceToUSD = async (
  nativeChainId: number,
  gasPrice: number,
  chainPriceDataInUSD: number,
  token: string,
) => {
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
        FeeOption.getNetworkPriceDataKey(),
      );
      let networkPriceData;
      if (!networkPriceDataInString) {
        networkPriceData = {
          1: '1652.34', 4: '1652.34', 5: '1652.34', 137: '0.80', 80001: '0.80',
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
          tokenGasPrice = new Big(tokenGasPrice).mul(10 ** decimal).toFixed(0).toString();
        } else {
        // calculate for cross chain
          const nativeChainId = config.feeOption.nativeChainIds[token];
          if (nativeChainId) {
            const gasPriceInUSD = await convertGasPriceToUSD(
              this.chainId,
              gasPrice,
              chainPriceDataInUSD,
              token,
            );
            const nativeChainPrice = networkPriceData[nativeChainId];
            tokenGasPrice = new Big(gasPriceInUSD).div(new Big(nativeChainPrice));
            tokenGasPrice = new Big(tokenGasPrice).mul(10 ** decimal).toFixed(0).toString();
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
      log.error(error);
      return {
        code: 500,
        error: `Error occured in getting fee options service. Error: ${error}`,
      };
    }
  }
}
