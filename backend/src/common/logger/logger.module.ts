import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { type SerializedRequest, type SerializedResponse } from 'pino';

import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { APP_NAME, GLOBAL_PREFIX } from '../constants.js';

const HEALTH_PATH = `/${GLOBAL_PREFIX}/health`;

/**
 * Logs estruturados sem payloads (handoff §11): cada request registra só id, método, URL,
 * status e duração. Nunca corpo, headers, query nem valores financeiros. O healthcheck do
 * container bate a cada 30 s e não é logado.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          name: APP_NAME,
          level: config.LOG_LEVEL,
          autoLogging: { ignore: (req) => req.url === HEALTH_PATH },
          serializers: {
            req: (req: SerializedRequest) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res: SerializedResponse) => ({ statusCode: res.statusCode }),
          },
          ...(config.NODE_ENV === 'development'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
  ],
})
export class LoggerModule {}
