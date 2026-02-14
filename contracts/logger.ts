import pino from 'pino';

export const createLogger = (level = 'info') =>
  pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  });