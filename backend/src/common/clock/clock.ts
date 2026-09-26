import { Injectable } from '@nestjs/common';

/** Fuso único do app para "hoje" e para agendamentos (PLAN §3.3, handoff §11). */
export const APP_TIME_ZONE = 'America/Sao_Paulo';

/** Token de injeção do relógio. Serviços recebem `Clock`, nunca chamam `new Date()`. */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  /** Instante atual, em UTC. */
  now(): Date;
  /** Data civil de hoje em `America/Sao_Paulo`, como `YYYY-MM-DD`. */
  today(): string;
}

const localDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Data civil (`YYYY-MM-DD`) de um instante em `America/Sao_Paulo`. Entre 00h e 03h UTC a data
 * UTC já virou e a de São Paulo não; por isso nunca use `toISOString().slice(0, 10)`.
 */
export function toLocalDate(instant: Date): string {
  const parts = localDateParts.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Intl não devolveu a parte "${type}" da data em ${APP_TIME_ZONE}.`);
    }
    return value;
  };
  return `${part('year')}-${part('month')}-${part('day')}`;
}

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): string {
    return toLocalDate(this.now());
  }
}

/** Relógio parado num instante, para testes. */
export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant.getTime());
  }

  today(): string {
    return toLocalDate(this.instant);
  }
}
