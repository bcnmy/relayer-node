import { curry } from 'lodash';
import { NotFoundError } from 'rest-api-errors';

export const STATUSES = {
  SUCCESS: 200,
  CREATED: 201,
  MOVED_PERMANENTLY: 301,
  ACTION_COMPLETE: 143,
  ACTION_FAILED: 144,
  USER_ALREADY_EXISTS: 145,
  NOT_LOGGED_IN: 146,
  USER_DOES_NOT_EXISTS: 146,
  TOKEN_EXPIRED: 147,
  USER_CONTRACT_WALLET_NOT_FOUND: 148,
  DAPP_LIMIT_REACHED: 150,
  USER_LIMIT_REACHED: 151,
  API_LIMIT_REACHED: 152,
  TOKEN_PRICE_UNACCEPTABLE: 153,
  DAPP_INACTIVE: 155,
  NO_CONTENT: 204,
  METHOD_NOT_ALLOWED: 405,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXPECTATION_FAILED: 417,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BICONOMY_ERROR: 506,
  BAD_GATEWAY: 502,
  TOO_MANY_REQUESTS: 429,
  UNSUPPORTED_NETWORK: 507,
};

export const DB_ERRORS = {
  DUPLICATE_ENTRY: 11000,
};

export const sendResponse = (res: any, data: {} | null, status = STATUSES.SUCCESS) => {
  res
    .status(status)
    .json(data)
    .end();
};

export const sendOne = curry((res: any, entity: any) => {
  if (!entity) {
    throw new NotFoundError();
  }
  return sendResponse(res, entity);
});

export const createResponseBody = (message: string, code: number, data?: string | undefined) => {
  const response: any = {};
  response.log = message;
  response.flag = code;
  response.message = data || '';
  return response;
};

export const sendUnsupportedAPIVersonResponse = (
  res: any,
  unsupportedVersion: any,
  newSupportedVersion: any,
) => {
  sendResponse(
    res,
    createResponseBody(`Version ${unsupportedVersion} is not supported. Please switch to version ${newSupportedVersion}`, STATUSES.MOVED_PERMANENTLY),
    STATUSES.MOVED_PERMANENTLY,
  );
};
