import { EVMRelayerMetaDataType } from '../types';

export class SortEVMRelayerByBalance {
  static performAlgorithm(relayerMapData: EVMRelayerMetaDataType[]): EVMRelayerMetaDataType[] {
    return relayerMapData.sort((a, b) => (a.balance.gte(b.balance) ? -1 : 1));
  }
}
