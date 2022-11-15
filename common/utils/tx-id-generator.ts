import crypto from 'crypto';

const randomInteger = (
  min: number,
  max: number,
): number => Math.floor(Math.random() * (max - min + 1)) + min;

export const generateTransactionId = (data: string) => {
  const hashData = `0x${crypto.createHash('sha256').update(data + Date.now() + randomInteger(1, 1000)).digest('hex')}`;
  return hashData;
};
