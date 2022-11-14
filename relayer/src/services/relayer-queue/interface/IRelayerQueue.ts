export interface IRelayerQueue<RelayerMetaDataType> {
  items: Array<RelayerMetaDataType>
  get(address: string): RelayerMetaDataType | undefined
  list(): Array<RelayerMetaDataType>
  pop(): Promise<RelayerMetaDataType | undefined>
  push(item: RelayerMetaDataType): Promise<void>
  size(): number
}
