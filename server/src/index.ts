import 'dotenv/config';
import { logger } from '../../common/log-config';
import { configInstance } from '../../config';

const log = logger(module);

(async () => {
  if (configInstance.active()) {
    const server = await import('./server');
    server.init();
  } else {
    log.info('Config not active');
  }
})();
