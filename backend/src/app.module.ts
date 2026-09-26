import { Module } from '@nestjs/common';

import { ClockModule } from './common/clock/clock.module.js';
import { ConfigModule } from './common/config/config.module.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [ConfigModule, LoggerModule, ClockModule, HealthModule],
})
export class AppModule {}
