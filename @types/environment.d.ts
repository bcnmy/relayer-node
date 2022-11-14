declare global {
  namespace NodeJS {
    interface ProcessEnv {
      REDIS_URL: string;
      RELAYER_QUEUE_URL: string;
      MONGO_URL: string;
      SUPPORTED_NETWORKS: string;
      WEB_SOCKET_URL: string;
      WEB_SOCKET_API_URL: string;
      CF_API_KEY: string;
      HMAC_SECRET_KEY: string;
      RELAYERS_MASTER_SEED: string;
      ETH_ACCOUNT_PASS: string;
      BICONOMY_OWNER_ADDRESS: string;
      BICONOMY_OWNER_PRIVATE_KEY: string;
      RELAYER_QUEUE_EXCHANGE: string;
    }
  }
}

export {};
