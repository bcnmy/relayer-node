import { createClient } from 'redis';
import { config } from '../../../config';
import { logger } from '../../log-config';
import { ICacheService } from '../interface';

const log = logger(module);

export class RedisCacheService implements ICacheService {
  private static instance: ICacheService;

  private redisClient;

  private constructor() {
    this.redisClient = createClient({
      url: config.dataSources.redisUrl,
    });
  }

  /**
   * Method gets instance of RedisCacheService
   * @returns RedisCacheService
   */
  public static getInstance(): ICacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Method creates connection to redis client instance
   */
  async connect(): Promise<void> {
    log.info('Initiating Redis connection');
    await this.redisClient.connect();
    log.info('Main Redis connected successfully');
    this.redisClient.on('error', (err: any) => {
      log.error(`Redis redisClient Error ${err}`);
    });
  }

  /**
   * Method closes connection to redis client instance
   */
  async close(): Promise<void> {
    await this.redisClient.quit();
  }

  /**
   * Method decrements value in cache
   * @param key of the value to be decremented
   * @param decrementBy amount to decrement
   * @returns true or false basis on success or failure
   */
  async decrement(key: string, decrementBy: number = 1): Promise<boolean> {
    log.info(`Checking if the key: ${key} exists`);
    // could use get service also here
    const val = await this.redisClient.get(key);
    if (val == null || val === 'undefined') {
      log.info('Key does not exist. Nothing to decrement');
      return false;
    }
    try {
      log.info(`Key exists. Decrementing cache value by ${decrementBy} => Key: ${key}`);
      await this.redisClient.decrBy(key, decrementBy);
      return true;
    } catch (error) {
      log.error(`Error in decrement value ${JSON.stringify(error)}`);
    }
    return false;
  }

  /**
   * Method deletes value in cache
   * @param key of the value to be deleted
   * @returns true or false basis on success or failure
   */
  async delete(key: string): Promise<boolean> {
    log.info(`Deleting cahce value => Key: ${key}`);
    try {
      const result = await this.redisClient.del(key);
      if (result) return true;
      return false;
    } catch (error) {
      log.error(`Error in deleting key ${key} - ${JSON.stringify(error)}`);
      return false;
    }
  }

  /**
   * Method sets value in cache with expiry time
   * @param key of the value that is to be set with expriry
   * @param expiryTime to be set in cache in seconds
   * @returns true or false basis on success or failure
   */
  async expire(key: string, expiryTime: number): Promise<boolean> {
    try {
      log.info(`Setting expirtyTime: ${expiryTime} for key: ${key}`);
      const result = await this.redisClient.expire(key, expiryTime);
      if (result) return true;
      return false;
    } catch (error) {
      log.error(JSON.stringify(error));
      return false;
    }
  }

  /**
   * Method gets value set for a key
   * @param key
   * @returns string value that is set in cache
   */
  async get(key: string): Promise<string> {
    try {
      log.info(`Getting key: ${key} from cache`);
      const result = await this.redisClient.get(key) || '';
      return result;
    } catch (error) {
      log.error(`Error getting value for key ${key} - ${JSON.stringify(error)}`);
    }
    return '';
  }

  /**
   * Method increments value of the passed key
   * @param key
   * @param incrementBy units to increment by
   * @returns true or false basis on success or failure
   */
  async increment(key: string, incrementBy: number = 1): Promise<boolean> {
    log.info(`Checking if the key: ${key} exists`);
    try {
      const val = await this.redisClient.get(key);
      if (!val) {
        log.info('Key does not exist. Nothing to increment');
        return false;
      }

      log.info(`Inrementing cache value by ${incrementBy} => Key: ${key}`);
      const result = await this.redisClient.incrBy(key, incrementBy);
      if (result) {
        log.info(`Incremented cache value by ${incrementBy} => Key: ${key}`);
        return true;
      }
      return false;
    } catch (error) {
      log.error(`Error in increment value - ${JSON.stringify(error)}`);
      return false;
    }
  }

  /**
   * Method sets values in cache for the passed key
   * @param key
   * @param value
   * @param hideValueInLogs true or false if value to be hidden in logs
   * @returns true or false basis on success or failure
   */
  async set(key: string, value: string, hideValueInLogs: boolean = false): Promise<boolean> {
    if (!hideValueInLogs) {
      log.info(`Setting cache value => Key: ${key} Value: ${value}`);
    } else {
      log.info(`Setting value in cache with key: ${key}`);
    }
    try {
      await this.redisClient.set(key, value);
      log.info(`Cache value set in logs for key: ${key}`);
      return true;
    } catch (error) {
      log.error(`Error setting value $${value} for key ${key} - ${JSON.stringify(error)}`);
      return false;
    }
  }
}
