import { Controller, Get, Inject } from '@nestjs/common';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { APP_NAME } from '../common/constants.js';

export interface HealthResponse {
  status: 'ok';
  app: string;
  /** Instante da resposta em UTC, ISO-8601. */
  now: string;
  /** Data civil em `America/Sao_Paulo`, `YYYY-MM-DD`. */
  today: string;
  uptimeSeconds: number;
}

@Controller('health')
export class HealthController {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      app: APP_NAME,
      now: this.clock.now().toISOString(),
      today: this.clock.today(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
