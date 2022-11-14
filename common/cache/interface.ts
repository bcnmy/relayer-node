export interface ICacheService {

  connect(): Promise<void>;
  close(): Promise<void>;
  get(key: string): Promise<string>
  set(key: string, value: string, hideValueInLogs?: boolean): Promise<boolean>
  increment(key: string, incrementBy ?: number): Promise<boolean>
  decrement(key: string, decrementBy ?: number): Promise<boolean>
  expire(key: string, expiryTime: number): Promise<boolean>
  delete(key: string): Promise<boolean>
}
