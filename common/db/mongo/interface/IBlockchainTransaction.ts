type RawTransactionType = {
  from: string;
  gasPrice?: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  gasLimit: {
    _hex: string;
    _isBigNumber: boolean;
  };
  to: string;
  value: {
    _hex: string;
    _isBigNumber: boolean;
  };
  data: string;
  chainId: number;
  nonce: number;
};

export interface IBlockchainTransaction {
  transactionId: string; // REVIEW // In case of funding relayer transactions no transactionId
  transactionType: string;
  transactionHash: string;
  previousTransactionHash?: string;
  status: string;
  rawTransaction: RawTransactionType;
  chainId: number;
  gasPrice: string;
  receipt: object;
  relayerAddress: string;
  walletAddress: string;
  metaData: any;
  resubmitted: boolean;
  creationTime: number;
  updationTime: number;
}
