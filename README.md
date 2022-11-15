# Relayer Node

The Relayer Node is responsible for validating transactions, paying their gas fees, and sending them to the network.
Relayers allow you to send transactions and take care of transaction sending, nonce management, gas pricing estimation, and resubmissions. This way you don’t need to worry about monitoring transactions to ensure they get mined.
The Relayer infrastructure composes of multiple EOAs on each chain. Every relayer has an inbuilt auto-scaling functionality. Thus in cases of a high load of transactions, the relayer infra can spin up additional relayers to handle this. A socket server is attached to the relayer node via which one can subscribe and get updates on the transaction events like transaction hash generated, transaction mined, etc.

<div>
    <a href="https://opensource.org/licenses/GPL-3.0"><img src="https://img.shields.io/badge/license-GPL--v3-blueviolet"/></a>
</div>

For a general guideline of how to contribute, see our [contribution guidelines](./contributing.md)

## Workflow best practices

### Branching

This project has two main branches, `main`, and `dev`. Then we do work based on branches off of `dev`.

`main`: Production branch. This is the code that's live for the project.  
`dev`: Staging branch. This represents what will be included in the next release.

As we work on features, we branch off of the `dev` branch: `git checkout -b feature/new-nav-bar`.

Working branches have the form `<type>/<feature>` where `type` is one of:

- feat
- fix
- hotfix
- chore
- refactor

### Commit Messages

#### Basic

`<type>(<scope>):<subject>`

Your basic commit messages should have a **type**, **scope**, and **subject**:

- _Type_ is one of the types listed above
- _Scope_ is the area of the code that the commit changes
- _Subject_ is a brief description of the work completed


## Local deployment 

### Requirements:

- Rabbitmq: https://www.rabbitmq.com/
- Centrifugo: https://github.com/centrifugal/centrifugo
- Redis: https://redis.io

For centrifugo use the following base configuration file
```
{
  "token_hmac_secret_key": "averystrongsecret",
  "admin_password": "usedIfAdminSetToTrue",
  "admin_secret": "averystrongsecretforadmin",
  "api_key": "usedforpostapi",
  "allowed_origins": ["*"],
  "debug": true,
  "admin": true,
  "log_level": "debug",
  "client_anonymous": true,
  "client_channel_limit": 512,
  "namespaces": [
    {
      "name": "relayer",
      "publish": true,
      "history_size": 10,
      "history_ttl": "300s",
      "recover": true,
      "anonymous": false
    },
    {
      "name": "transaction",
      "publish": true,
      "history_size": 10,
      "history_ttl": "300s",
      "recover": true,
      "anonymous": true
    }
  ]
}
```

## Steps to run the project

1. Clone the project

```jsx
git clone https://github.com/bcnmy/relayer-node.git
```

2. Checkout to the main branch

```jsx
git checkout main
```

3. Install dependencies. Make sure node version is 16 or above.
```jsx
yarn install
```

4. Check if config.json.enc file exists in the config folder at the root of the repository. If not or if you want to make any changes in the configuration. Create a file config.json in the config folder. You can use the template shown below for local deployment or find the config-example.json file in the folder.

```jsx
{
  "slack": {
    "token": "",
    "channel": ""
  },
  "dataSources": {
    "mongoUrl": "",
    "redisUrl": ""
  },
  "socketService": {
    "token": "",
    "apiKey": ""
  },
  "relayer": {
    "nodePathIndex": 0
  },
  "queueUrl": "",
  "simulationData": {
    "tenderlyData": {
      "tenderlyUser": "",
      "tenderlyProject": "",
      "tenderlyAccessKey": ""
    }
  },
  "chains": {
    "provider": {
      "5": "",
      "137": "",
      "80001": "",
      "97": "",
      "420": "",
      "421613": "",
      "43113": ""
    }
  },
  "relayerManagers": [{
    "relayerSeed": "",
    "ownerAccountDetails": {
      "5": {
        "publicKey": "",
        "privateKey": ""
      },
      "137": {
        "publicKey": "",
        "privateKey": ""
      },
      "80001": {
        "publicKey": "",
        "privateKey": ""
      },
      "97": {
        "publicKey": "",
        "privateKey": ""
      },
      "420": {
        "publicKey": "",
        "privateKey": ""
      },
      "421613": {
        "publicKey": "",
        "privateKey": ""
      },
      "43113": {
        "publicKey": "",
        "privateKey": ""
      }
    }
  }],
  "tokenPrice": {
    "coinMarketCapApi": ""
  }
}
```

To update the config.json.enc file run ts-node encrypt-config.ts

5. To update the configuration for chain specific parameters (provider url, currency, decimals), relayer manager, fee options, and transactions use static-config.json in the config folder.  

6. Run the following code to start the project.
```jsx
yarn run build && yarn run start
```

