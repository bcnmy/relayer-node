import { RedisCacheService } from '../../common/cache';
import { GasPriceManager } from '../../common/gas-price';
import { EVMNetworkService } from '../../common/network';
import { config } from '../../config';
import { FeeOption } from '../../server/src/services';

const chainId = 5;
const cacheService = RedisCacheService.getInstance();
const networkService = new EVMNetworkService({
  chainId,
  rpcUrl: config.chains.provider[chainId],
  fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
});

// test feeoption endpoint
describe('get fee options', () => {
  beforeAll(async () => {
    await cacheService.connect();
  });

  it(`should return fee options for chainId ${chainId}`, async () => {
    const gasPriceManager = new GasPriceManager(cacheService, networkService, {
      chainId,
      EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
    });
    const gasPriceService = gasPriceManager.setup();
    expect(gasPriceService).toBeDefined();
    if (gasPriceService) {
      const feeOptionService = new FeeOption(gasPriceService, cacheService, {
        chainId,
      });
      const { response, code } = await feeOptionService.get();

      expect(code).toBe(200);
      expect(response).toBeDefined();

      if (response) {
        expect(Array.isArray(response)).toBe(true);
        expect(response.length).toBeGreaterThan(0);

        expect(response[0]).toHaveProperty('tokenGasPrice');
        expect(response[0]).toHaveProperty('symbol');
        expect(response[0]).toHaveProperty('decimal');
        expect(response[0]).toHaveProperty('offset');
        expect(response[0]).toHaveProperty('address');
        expect(response[0]).toHaveProperty('logoUrl');
        expect(response[0]).toHaveProperty('feeTokenTransferGas');
        expect(response[0]).toHaveProperty('refundReceiver');

        expect(typeof response[0].tokenGasPrice).toBe('number');
        expect(typeof response[0].symbol).toBe('string');
        expect(typeof response[0].decimal).toBe('number');
        expect(typeof response[0].offset).toBe('number');
        expect(typeof response[0].address).toBe('string');
        expect(typeof response[0].logoUrl).toBe('string');
        expect(typeof response[0].feeTokenTransferGas).toBe('number');
        expect(typeof response[0].refundReceiver).toBe('string');

        expect(response[0].symbol).toBe('ETH');
        expect(response[0].decimal).toBe(18);
        expect(response[0].offset).toBe(1);
        expect(response[0].address).toBe(
          '0x0000000000000000000000000000000000000000',
        );
        expect(response[0].logoUrl).toBe(
          'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
        );
        expect(response[0].feeTokenTransferGas).toBe(7300);
        expect(response[0].refundReceiver).toBe(
          '0x040a9cbC4453B0eeaE12f3210117B422B890C1ED',
        );
      }
    }
  });

  afterAll(async () => {
    await cacheService.close();
  });
});
