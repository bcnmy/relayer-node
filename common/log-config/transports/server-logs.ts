/* eslint-disable no-param-reassign */
import winston from 'winston';
import { hostname } from 'os';
import rTracer from 'cls-rtracer';
import { EventEmitter } from 'events';

const consoleTransport = new winston.transports.Console({
  level: process.env.LOG_LEVEL || 'debug',
});

const transports = [
  consoleTransport,
];
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

const serverTransport = (path: string) => winston.createLogger({
  // silent: false,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss SSS',
    }),
    winston.format((info: any) => {
      info.path = path;
      info.hostname = hostname();
      info['request-id'] = rTracer.id();
      if (info.level === 'http') {
        const requestData = info?.message.trim().split(' ');
        const [method, url, status, contentLength, responseTime] = requestData;
        info.method = method;
        info.url = url;
        info.status = status;
        info['content-length'] = contentLength;
        info['response-time'] = responseTime;
        delete info.path;
        delete info.message;
      }
      return info;
    })(),
    winston.format.json(),
  ),
  transports,
});

const logger = (module: { filename: string; }) => {
  const path = module.filename.split('/').slice(-4).join('/');
  return serverTransport(path);
};

export { logger, serverTransport };
