import { EVMRelayerMetaDataType } from '../types';

export class SortEVMRelayerByLeastPendingCount {
  static performAlgorithm(relayerMapData: EVMRelayerMetaDataType[]): EVMRelayerMetaDataType[] {
    return relayerMapData.sort((a, b) => a.pendingCount - b.pendingCount);
  }
}
