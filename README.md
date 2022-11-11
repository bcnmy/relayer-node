# Relayer Node Service

The relayer node allows anyone to spin up their own multichain relayer

<div>
    <a href="https://opensource.org/licenses/GPL-3.0"><img src="https://img.shields.io/badge/license-GPL--v3-blueviolet"/></a>
</div>

For a general guideline of how to contribute, see our [contribution guidelines](./contributing.md)

## Workflow best practices

### Branching

This project has two main branches, `main`, and `dev`. Then we do work based on branches off of `dev`.

`main`: Production branch. This is code that's live for the project.  
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
git clone https://github.com/bcnmy/relayer-node-service.git
```

2. Checkout to development branch

```jsx
git checkout development
```

3. Install 
```jsx
yarn install
```

4. Check if config.json.enc file exists in the config folder in the root of the repository. If not or if you want to make any changes in the configuration. Create a file config.json in config folder. You can use the template shown below for local deployment or find config-example.json file in the folder.

```jsx
{
  "slack": {
    "token": "",
    "channel": "1BQKZLQ0Y"
  },
  "dataSources": {
    "mongoUrl": "mongodb://localhost:27017",
    "redisUrl": "redis://localhost:6379"
  },
  "socketService": {
    "wssUrl": "ws://localhost:9000/connection/websocket",
    "httpUrl": "http://localhost:9000/api",
    "token": "9edb7c38-0f55-4627-9bda-4cc050b5f6cb",
    "apiKey": "a4c3c3df-4294-4719-a6a6-0c3416d68466"
  },
  "queueUrl": "amqp://localhost:5672?heartbeat=30",
}
```

To update the config.json.enc file run ts-node encrypt-config.ts

5. To update configuration for chain specific parameters (provider url, currency, decimals), relayer manager, fee options, transacactions use static-config.json in the config folder.  

6. Run the following code to start the project. It supports goerli and mumbai
```jsx
yarn run dev
```

