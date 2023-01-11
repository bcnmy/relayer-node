import crypto from 'crypto-js';
import fs, { existsSync } from 'fs';
import _, { isNumber } from 'lodash';
import path from 'path';

import { ConfigType, IConfig } from './interface/IConfig';

const KEY_SIZE = 32;
const PBKDF2_ITERATIONS = 100000;
const AES_PADDING = crypto.pad.Pkcs7;
const AES_MODE = crypto.mode.CBC;

export class Config implements IConfig {
  config: ConfigType;

  constructor() {
    // decrypt the config and load it
    const encryptedEnvPath = './config.json.enc';
    const passphrase = process.env.CONFIG_PASSPHRASE;
    if (!passphrase) {
      throw new Error('Passphrase for config required in .env file');
    }

    if (!existsSync(encryptedEnvPath)) {
      throw new Error(`Invalid ENV Path: ${encryptedEnvPath}`);
    }
    const ciphertext = fs.readFileSync(encryptedEnvPath, 'utf8');
    // First 44 bits are Base64 encodded HMAC
    const hashInBase64 = ciphertext.substr(0, 44);

    // Next 32 bits are the salt
    const salt = crypto.enc.Hex.parse(ciphertext.substr(44, 32));

    // Next 32 bits are the initialization vector
    const iv = crypto.enc.Hex.parse(ciphertext.substr(44 + 32, 32));

    // Rest is encrypted .env
    const encrypted = ciphertext.substr(44 + 32 + 32);

    // Derive key from passphrase
    const key = crypto.PBKDF2(passphrase, salt, {
      keySize: KEY_SIZE / 32,
      iterations: PBKDF2_ITERATIONS,
    });

    const bytes = crypto.AES.decrypt(encrypted, key, {
      iv,
      padding: AES_PADDING,
      mode: AES_MODE,
    });

    const plaintext = bytes.toString(crypto.enc.Utf8);

    // Verify HMAC
    const decryptedHmac = crypto.HmacSHA256(plaintext, key);
    const decryptedHmacInBase64 = crypto.enc.Base64.stringify(decryptedHmac);

    if (decryptedHmacInBase64 !== hashInBase64) {
      throw new Error('Error: HMAC does not match');
    }
    const data = JSON.parse(plaintext) as ConfigType;
    const staticConfig = JSON.parse(fs.readFileSync(path.resolve('./config/static-config.json'), 'utf8'));

    this.config = _.merge(data, staticConfig);
    this.validate();
  }

  validate(): boolean {
    // check for each supported networks if the config is valid
    for (const chainId of this.config.supportedNetworks) {
      if (!this.config.supportedTransactionType[chainId].length) {
        throw new Error(`No supported transaction type for chain id ${chainId}`);
      }

      // check for chains config
      if (!this.config.chains.currency[chainId]) {
        throw new Error(`Signer for chain id ${chainId}`);
      }
      if (!this.config.chains.provider[chainId]) {
        throw new Error(`Provider required for chain id ${chainId}`);
      }
      if (!this.config.chains.decimal[chainId]) {
        throw new Error(`Decimals required for chain id ${chainId}`);
      }
      if (!this.config.chains.retryTransactionInterval[chainId]) {
        throw new Error(`Retry transaction interval required for chain id ${chainId}`);
      }

      // check for transaction config
      if (!this.config.transaction.errors.networkResponseMessages) {
        throw new Error('Network response messages are required');
      }
      if (!this.config.transaction.errors.networksNonceError[chainId]) {
        throw new Error(`Network nonce error required for chain id ${chainId}`);
      }
      if (!this.config.transaction.errors.networksInsufficientFundsError[chainId]) {
        throw new Error(`Network insufficient funds error required for chain id ${chainId}`);
      }

      if (!this.config.entryPointData[chainId].length) {
        throw new Error(`Entry point data address required for chain id ${chainId}`);
      }

      if (!isNumber(this.config.relayer.nodePathIndex)) {
        throw new Error('Relayer node path index required');
      }

      if (!this.config.relayerManagers.length) {
        throw new Error(`Relayer manager required for chain id ${chainId}`);
      }

      // check valid gas price config
      if (!this.config.gasPrice[chainId]) {
        throw new Error(`Gas price configuration required for chain id ${chainId}`);
      }
      if (!this.config.gasPrice[chainId].updateFrequencyInSeconds) {
        throw new Error(`Gas price update frequency required for chain id ${chainId}`);
      }
      if (!this.config.gasPrice[chainId].updateFrequencyInSeconds) {
        throw new Error(`Gas price update frequency required for chain id ${chainId}`);
      }
      if (!this.config.gasPrice[chainId].maxGasPrice) {
        throw new Error(`Max gas price required for chain id ${chainId}`);
      }
      if (!this.config.gasPrice[chainId].minGasPrice) {
        throw new Error(`Min gas price required for chain id ${chainId}`);
      }
      if (!this.config.gasPrice[chainId].baseFeeMultiplier) {
        throw new Error(`Gas price base fee multiplier required for chain id ${chainId}`);
      }

      // check valid fee options config
      if (!this.config.feeOption.supportedFeeTokens[chainId].length) {
        throw new Error(`Supported fee tokens required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.similarTokens[chainId].length) {
        throw new Error(`Similar tokens required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.offset[chainId]) {
        throw new Error(`Offset required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.logoUrl[chainId]) {
        throw new Error(`Logo url required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.tokenContractAddress[chainId]) {
        throw new Error(`Token contract address required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.decimals[chainId]) {
        throw new Error(`Decimals required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.feeTokenTransferGas[chainId]) {
        throw new Error(`Decimals required for chain id ${chainId}`);
      }
      if (!this.config.feeOption.refundReceiver[chainId]) {
        throw new Error(`Refund receiver required for chain id ${chainId}`);
      }

      if (!this.config.tokenPrice.coinMarketCapApi) {
        throw new Error('Coin market cap API required');
      }
      if (!this.config.tokenPrice.networkSymbols) {
        throw new Error('Network symbols required');
      }
      if (!this.config.tokenPrice.updateFrequencyInSeconds) {
        throw new Error('Token price update frequency required');
      }
      if (!this.config.tokenPrice.symbolMapByChainId[chainId]) {
        throw new Error(`Symbol map required for chain id ${chainId}`);
      }
    }
    return true;
  }

  update(data: object): boolean {
    this.config = _.merge(this.config, data);
    return true;
  }

  get(): ConfigType {
    return this.config;
  }

  active(): boolean {
    return !!this.config.queueUrl;
  }
}

export const configInstance = new Config();
export const config = configInstance.get();
