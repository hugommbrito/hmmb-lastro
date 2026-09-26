import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * Variáveis de ambiente aceitas pela API. Tudo o que o app lê do ambiente passa por aqui,
 * com default explícito ou obrigatório; variáveis desconhecidas são ignoradas.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Token de injeção da configuração validada. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export class InvalidEnvironmentError extends Error {
  constructor(readonly issues: string) {
    super(`Variáveis de ambiente inválidas:\n${issues}`);
    this.name = 'InvalidEnvironmentError';
  }
}

/**
 * Valida o ambiente e devolve a configuração tipada. Em caso de erro, a mensagem lista os
 * caminhos e os motivos, nunca os valores recebidos, para não vazar segredos em log.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new InvalidEnvironmentError(z.prettifyError(result.error));
  }
  return result.data;
}
