import { serializeError } from 'serialize-error';

export const parseError = (error: any): string => {
  if (error instanceof Error) {
    return serializeError(error)?.message || 'Unable to parse error';
  }
  return error;
};
