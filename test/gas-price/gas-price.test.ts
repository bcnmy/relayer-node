import { RedisCacheService } from '../../common/cache';
import { GasPriceManager, GasPriceServiceType } from '../../common/gas-price';
import { GasPriceType } from '../../common/gas-price/types';
import { EVMNetworkService } from '../../common/network';
import { config } from '../../config';

const chainId = 5;

const cacheService = RedisCacheService.getInstance();

const networkServiceMap: {
  [chainId: number]: EVMNetworkService;
} = {};
const gasPriceServiceMap: {
  [chainId: number]: GasPriceServiceType;
} = {};

networkServiceMap[chainId] = new EVMNetworkService({
  chainId,
  rpcUrl: config.chains.provider[chainId],
  fallbackRpcUrls: config.chains.fallbackUrls[chainId] || [],
});

const gasPriceManager = new GasPriceManager(cacheService, networkServiceMap[chainId], {
  chainId,
  EIP1559SupportedNetworks: config.EIP1559SupportedNetworks,
});
gasPriceServiceMap[chainId] = gasPriceManager.setup();

// create test in jest to check if gas price are updating correctly
describe('Gas Price', () => {
  beforeAll(async () => {
    await cacheService.connect();
  });

  it(`should update gas price in redis for chainId: ${chainId}`, async () => {
    await gasPriceServiceMap[chainId]?.setGasPrice(GasPriceType.DEFAULT, '1000000000');
  });

  it(`should get gas price from redis for chainId: ${chainId}`, async () => {
    const gasPrice = await gasPriceServiceMap[chainId]?.getGasPrice(GasPriceType.DEFAULT);
    expect(gasPrice).not.toBeNull();
    expect(typeof gasPrice).toBe('string');
    expect(Number(gasPrice)).toBeGreaterThan(0);
    expect(gasPrice).toBe('1000000000');
  });

  afterAll(async () => {
    await cacheService.close();
  });
});
