import crypto from 'crypto-js';
import { promises, existsSync } from 'fs';

const KEY_SIZE = 32;
const PBKDF2_ITERATIONS = 100000;
const AES_PADDING = crypto.pad.Pkcs7;
const AES_MODE = crypto.mode.CBC;

const encryptConfig = async (
  passphrase: string,
  envPath = './config/config.json',
  outputPath = './config.json.enc',
) => {
  if (!existsSync(envPath)) {
    throw new Error(`Invalid ENV Path: ${envPath}`);
  }
  const plaintext = await promises.readFile(envPath, 'utf8');

  // Derive a Key using the PBKDF2 algorithm from the passsphrase
  const salt = crypto.lib.WordArray.random(128 / 8);
  const key = crypto.PBKDF2(passphrase, salt, {
    keySize: KEY_SIZE / 32,
    iterations: PBKDF2_ITERATIONS,
  });

  const iv = crypto.lib.WordArray.random(128 / 8);
  const encrypted = crypto.AES.encrypt(plaintext, key, {
    iv,
    padding: AES_PADDING,
    mode: AES_MODE,
  });

  // Use HMAC to check data tampering during decryption
  const hash = crypto.HmacSHA256(plaintext, key);
  const hashInBase64 = crypto.enc.Base64.stringify(hash);

  // Append salt and IV for use in Decryption
  const ciphertext = hashInBase64.toString()
    + salt.toString()
    + iv.toString()
    + encrypted.toString();

  await promises.writeFile(outputPath, ciphertext);
  console.log('completed');
  process.exit(1);
};

encryptConfig('averystrongpassword');
