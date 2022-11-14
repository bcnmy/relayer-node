import Joi from 'joi';

const {
  number,
  object,
  string,
  alternatives,
  array,
} = Joi.types();

export const scwRequestSchema = object.keys({
  method: string.regex(/eth_sendSmartContractWalletTransaction/),
  params: array.items(object.keys(
    {
      value: number,
      to: string.regex(/^0x[a-fA-F0-9]{40}$/).required().error(new Error('to is required')),
      gasLimit: string, // in hex
      data: string.required().error(new Error('data is required')),
      chainId: number.required().error(new Error('chainId is required')),
      walletInfo: object.keys({
        address: string.required().error(new Error('address is required')),
      }).error(new Error('walletAddress is required')),
      refundInfo: object.keys({
        tokenGasPrice: string.required().error(new Error('tokenGasPrice is required')),
        gasToken: string.required().error(new Error('gasToken is required')),
      }).required().error(new Error('refundInfo is required')),
    },
  )),
  jsonrpc: string.required().error(new Error('jsonrpc is required')),
  id: number.required().error(new Error('id is required')),
});

const userOp = object.keys({
  sender: string.regex(/^0x[a-fA-F0-9]{40}$/).required().error(new Error('sender address is required')),
  nonce: string.required().error(new Error('nonce is required and should be a hex string')),
  initCode: string,
  callData: string.required().error(new Error('callData is required and should be a hex string')),
  callGasLimit: string.required().error(new Error('callGasLimit is required and should be a hex string')),
  verificationGasLimit: string.required().error(new Error('verificationGasLimit is required and should be a hex string')),
  preVerificationGas: string.required().error(new Error('preVerificationGas is required and should be a hex string')),
  maxFeePerGas: string.required().error(new Error('maxFeePerGas is required and should be a hex string')),
  maxPriorityFeePerGas: string.required().error(new Error('maxPriorityFeePerGas is required and should be a hex string')),
  paymasterAndData: string,
  signature: string.required().error(new Error('signature is required')),
});

const entryPointAddress = string.required().error(new Error('entryPointAddress is required'));
const chainId = number.required().error(new Error('chainId is required'));
const metaData = object.keys({
  dappAPIKey: string.required().error(new Error('dappAPIKey is required')),
});

export const aaRequestSchema = object.keys({
  method: string.regex(/eth_sendUserOperation/),
  params: array.items(alternatives.try(
    userOp,
    entryPointAddress,
    chainId,
    metaData,
  )),
  jsonrpc: string.required().error(new Error('jsonrpc is required')),
  id: number.required().error(new Error('id is required')),
});

// TODO: Update Schema & REVIEW
export const crossChainRequestSchema = object.keys({
  method: string.regex(/eth_sendCrossChainTransaction/),
  params: object.keys({
    value: number,
    to: string.regex(/^0x[a-fA-F0-9]{40}$/).required().error(new Error('to address is required')),
    gasLimit: string, // in hex
    data: string.required().error(new Error('data is required')),
    chainId: number.required().error(new Error('chainId is required')),
    refundInfo: object.keys({
      tokenGasPrice: string.required().error(new Error('tokenGasPrice is required')),
      gasToken: string.required().error(new Error('gasToken type sent in request is required')),
    }).required().error(new Error('refundInfo is required')),
  }),
  jsonrpc: string.required().error(new Error('jsonrpc is required')),
  id: number.required().error(new Error('id is required')),

});

export const feeOptionsSchema = object.keys({
  chainId: string.valid('5', '80001'),
});

// validate schema with a query parameter of transactionId
export const transactionStatusSchema = object.keys({
  chainId: string.required().valid('5', '80001'),
  transactionId: string.required().error(new Error('transactionId is required')),
});

export const transactionResubmitSchema = object.keys({
  chainId: number.required().valid(5, 80001),
  transactionId: string.required().error(new Error('transactionId is required')),
  gasPrice: number.required().error(new Error('gasPrice is required')),
});
