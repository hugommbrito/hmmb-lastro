import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { CLOCK, FixedClock } from '../common/clock/clock.js';
import { APP_NAME, GLOBAL_PREFIX } from '../common/constants.js';

describe('GET /api/health', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(new Date('2026-09-27T01:00:00Z')))
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix(GLOBAL_PREFIX);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 com o nome do app e a data civil em America/Sao_Paulo', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    expect(body).toMatchObject({
      status: 'ok',
      app: APP_NAME,
      now: '2026-09-27T01:00:00.000Z',
      today: '2026-09-26',
    });
  });

  it('não atende sem o prefixo /api (ADR-003)', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(404);
  });
});
