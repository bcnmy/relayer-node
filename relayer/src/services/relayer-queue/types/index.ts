import { ethers } from 'ethers';

export type EVMRelayerMetaDataType = {
  address: string;
  nonce: number;
  pendingCount: number;
  balance: ethers.BigNumber;
};
