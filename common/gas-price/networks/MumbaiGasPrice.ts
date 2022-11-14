import { schedule } from 'node-cron';
import { config } from '../../../config';
import { IEVMAccount } from '../../../relayer/src/services/account';
import { ICacheService } from '../../cache';
import { INetworkService } from '../../network';
import { IScheduler } from '../../scheduler';
import { EVMRawTransactionType } from '../../types';
import { GasPrice } from '../GasPrice';

export class MumbaiGasPrice extends GasPrice implements IScheduler {
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

  schedule() {
    schedule(`*/${this.updateFrequencyInSeconds} * * * * *`, () => {
      this.setup();
    });
  }
}
