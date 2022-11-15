export interface IDBService {
  connect(): void
  close(): void
  isConnected(): boolean
}
