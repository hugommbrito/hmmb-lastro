import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './common/config/env.js';
import { APP_NAME, GLOBAL_PREFIX } from './common/constants.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.PORT, '0.0.0.0');
  logger.log(
    `${APP_NAME} API escutando em :${String(config.PORT)}/${GLOBAL_PREFIX} (${config.NODE_ENV})`,
  );
}

bootstrap().catch((error: unknown) => {
  // Antes do logger existir (por exemplo, ambiente inválido) só resta o stderr.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
