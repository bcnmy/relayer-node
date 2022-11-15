import { Mutex } from 'async-mutex';
import { IRelayerQueue } from './interface/IRelayerQueue';
import { SortEVMRelayerByBalance } from './strategy';
import { EVMRelayerMetaDataType } from './types';

const popMutex = new Mutex();
const pushMutex = new Mutex();

export class EVMRelayerQueue implements IRelayerQueue<EVMRelayerMetaDataType> {
  items: Array<EVMRelayerMetaDataType>;

  constructor(items: Array<EVMRelayerMetaDataType>) {
    this.items = items;
  }

  /**
   * @returns the size of relayer queue
   */
  size(): number {
    return this.items.length;
  }

  /**
   * @returns list of relayers with relayer meta data
   */
  list(): Array<EVMRelayerMetaDataType> {
    return this.items;
  }

  /**
   * @param address relayer address to fetch from queue
   * @returns relayer meta data
   */
  get(address:string): EVMRelayerMetaDataType | undefined {
    const filteredItem = this.items.filter((item) => item.address === address);
    if (filteredItem.length > 0) {
      return filteredItem[0];
    }
    return undefined;
  }

  /**
   * Method pops a relayer from active relayer queue
   * @returns relayer with relayer meta data
   */
  async pop(): Promise<EVMRelayerMetaDataType | undefined> {
    return popMutex.runExclusive(() => this.items.shift());
  }

  /**
   * Method pushes a relayer with relayer meta data into the active relayer queue
   * @param item relayer with relayer meta data
   * @returns mutex
   */
  async push(item: EVMRelayerMetaDataType): Promise<void> {
    return pushMutex.runExclusive(() => {
      this.items.push(item);
      this.items = SortEVMRelayerByBalance.performAlgorithm(
        this.items,
      );
    });
  }
}
