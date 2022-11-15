import { Request, Response } from 'express';
import { logger } from '../../../../common/log-config';
import { relayerManagerTransactionTypeNameMap } from '../../../../common/maps';
import { EVMRelayerManagerMap, transactionDao, transactionSerivceMap } from '../../../../common/service-manager';
import { TransactionType } from '../../../../common/types';
import { parseError } from '../../../../common/utils';

const log = logger(module);

export const transactionResubmitApi = async (req: Request, res: Response) => {
  const { chainId, transactionId, gasPrice } = req.body;

  // convert gas price to hex
  const gasPriceInHex = `0x${parseInt(gasPrice, 10).toString(16)}`;

  const transactions = await transactionDao.getByTransactionId(chainId, transactionId);
  try {
    if (transactions?.length !== 1) {
      return res.status(404).json({
        code: 404,
        error: 'Transaction not found',
      });
    }
    const transaction = transactions[0];
    log.info(`Transaction to be retried found of type ${transaction.transactionType}`);
    // find the relayer that has initiated the transaction using EVMRelayerManager
    const relayerManagerName = relayerManagerTransactionTypeNameMap[
      transaction.transactionType as TransactionType];
    log.info(`Relayer manager name: ${relayerManagerName}`);
    const relayer = EVMRelayerManagerMap[relayerManagerName][chainId]
      .getRelayer(
        transaction.relayerAddress,
      );
    if (relayer) {
      const rawTransaction = {
        from: relayer.getPublicKey(),
        gasPrice: gasPriceInHex,
        gasLimit: transaction.rawTransaction.gasLimit._hex,
        to: transaction.rawTransaction.to,
        value: transaction.rawTransaction.value._hex,
        data: transaction.rawTransaction.data,
        chainId,
        nonce: transaction.rawTransaction.nonce,
      };
      log.info(`Resubmitting transaction ${transactionId} with gasPrice ${gasPrice} on chainId ${chainId} and raw transaction data ${JSON.stringify(rawTransaction)}`);
      const result = await transactionSerivceMap[chainId].executeTransaction({
        rawTransaction,
        account: relayer,
      });
      log.info(`Resubmitted transaction ${transactionId} on chainId ${chainId} and result ${JSON.stringify(result)}`);
      if (result.success) {
        return res.json({
          code: 200,
          data: {
            transactionResponse: result.transactionResponse,
          },
        });
      }
      return res.status(400).json({
        code: 400,
        error: result.error,
      });
    }

    return res.status(404).json({
      code: 404,
      error: 'Relayer not found',
    });
  } catch (error) {
    log.error(`Error in transaction resubmit ${parseError(error)}`);
    return res.status(500).json({
      code: 500,
      error: parseError(error),
    });
  }
};
