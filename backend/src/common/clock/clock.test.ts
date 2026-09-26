import { describe, expect, it } from 'vitest';

import { FixedClock, SystemClock, toLocalDate } from './clock.js';

describe('toLocalDate em America/Sao_Paulo (UTC-3, sem horário de verão desde 2019)', () => {
  it.each([
    ['2026-09-26T20:59:59Z', '2026-09-26', '17:59:59 em SP'],
    ['2026-09-26T21:00:00Z', '2026-09-26', '18:00 em SP: início da janela 21h–00h UTC'],
    ['2026-09-26T23:59:59Z', '2026-09-26', '20:59:59 em SP: UTC ainda no mesmo dia'],
    ['2026-09-27T00:00:00Z', '2026-09-26', '21:00 em SP: UTC já virou, SP não'],
    ['2026-09-27T02:59:59Z', '2026-09-26', '23:59:59 em SP'],
    ['2026-09-27T03:00:00Z', '2026-09-27', '00:00 em SP: virada do dia'],
    ['2026-12-31T23:30:00Z', '2026-12-31', '20:30 em SP na véspera de ano novo'],
    ['2027-01-01T02:30:00Z', '2026-12-31', 'virada de ano: UTC em 2027, SP ainda em 2026'],
    ['2027-01-01T03:00:00Z', '2027-01-01', 'ano novo em SP'],
  ])('%s → %s (%s)', (iso, expected) => {
    expect(toLocalDate(new Date(iso))).toBe(expected);
  });

  it('difere da data UTC entre 00h e 03h UTC', () => {
    const instant = new Date('2026-09-27T01:00:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-09-27');
    expect(toLocalDate(instant)).toBe('2026-09-26');
  });
});

describe('FixedClock', () => {
  it('devolve o instante fixado e a data civil correspondente', () => {
    const clock = new FixedClock(new Date('2026-09-27T01:00:00Z'));
    expect(clock.now().toISOString()).toBe('2026-09-27T01:00:00.000Z');
    expect(clock.today()).toBe('2026-09-26');
  });

  it('devolve uma cópia do instante, não a referência interna', () => {
    const clock = new FixedClock(new Date('2026-09-27T01:00:00Z'));
    clock.now().setUTCFullYear(2000);
    expect(clock.now().toISOString()).toBe('2026-09-27T01:00:00.000Z');
  });
});

describe('SystemClock', () => {
  it('now() acompanha o relógio do sistema e today() deriva de now()', () => {
    const clock = new SystemClock();
    const now = clock.now();
    expect(Math.abs(now.getTime() - Date.now())).toBeLessThan(1000);
    expect(clock.today()).toBe(toLocalDate(now));
  });
});
