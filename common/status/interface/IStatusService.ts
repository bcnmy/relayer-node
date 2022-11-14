import {
  MongoStatusResponseType,
  NetworkServiceStatusResponseType,
  RedisStatusResponseType,
  TokenPriceStatusResponseType,
} from '../types';

export interface IStatusService {
  checkRedis(): Promise<RedisStatusResponseType>;
  checkMongo(): Promise<MongoStatusResponseType>;
  checkRelayerManager(): Promise<any>;
  checkNetworkService(): Promise<NetworkServiceStatusResponseType>;
  checkTokenPrice(): Promise<TokenPriceStatusResponseType>;
}
