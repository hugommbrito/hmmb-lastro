import { describe, expect, it } from 'vitest';

import { InvalidEnvironmentError, loadConfig } from './env.js';

describe('loadConfig', () => {
  it('aplica os defaults quando o ambiente está vazio', () => {
    expect(loadConfig({})).toEqual({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
  });

  it('converte PORT para número e aceita os enums', () => {
    expect(loadConfig({ NODE_ENV: 'production', PORT: '8080', LOG_LEVEL: 'warn' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      LOG_LEVEL: 'warn',
    });
  });

  it('ignora variáveis desconhecidas', () => {
    expect(loadConfig({ SECRET_TOKEN: 'x' })).not.toHaveProperty('SECRET_TOKEN');
  });

  it.each([
    ['PORT não numérica', { PORT: 'abc' }],
    ['PORT fora da faixa', { PORT: '70000' }],
    ['PORT vazia', { PORT: '' }],
    ['NODE_ENV fora do enum', { NODE_ENV: 'staging' }],
    ['LOG_LEVEL fora do enum', { LOG_LEVEL: 'verbose' }],
  ])('rejeita %s', (_label, env) => {
    expect(() => loadConfig(env)).toThrow(InvalidEnvironmentError);
  });

  it('cita o caminho da variável inválida sem repetir o valor recebido', () => {
    let message = '';
    try {
      loadConfig({ PORT: 'segredo-que-nao-pode-vazar' });
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('PORT');
    expect(message).not.toContain('segredo-que-nao-pode-vazar');
  });
});
