import pino from 'pino';

import { createApp } from './app.js';
import { loadRuntimeEnv } from './config.js';

const env = loadRuntimeEnv();

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
});

const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started');
});
