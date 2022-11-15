export type Type2TransactionGasPriceType = {
  maxPriorityFeePerGas: string;
  maxFeePerGas: string
};

export type Type0TransactionGasPriceType = {
  gasPrice: string
};

export type ContractEventFilterType = {
  address: string,
  topics: Array<string>
};
