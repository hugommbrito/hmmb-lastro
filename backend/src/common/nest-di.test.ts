import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

// Canário do tooling: garante que o Vitest compila decorators com metadata
// (emitDecoratorMetadata), sem o que a injeção por tipo do NestJS não resolve dependências.

@Injectable()
class Dependency {}

@Injectable()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

describe('injeção por tipo do NestJS no Vitest', () => {
  it('resolve o construtor pela metadata dos decorators', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [Dependency, Consumer],
    }).compile();
    expect(moduleRef.get(Consumer).dependency).toBeInstanceOf(Dependency);
  });
});
