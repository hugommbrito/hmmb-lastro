import { Global, Module } from '@nestjs/common';

import { APP_CONFIG, loadConfig } from './env.js';

/** Disponibiliza a configuração validada (`APP_CONFIG`) para qualquer módulo. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
