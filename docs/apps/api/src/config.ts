import 'dotenv/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  mongodbDb: string;
  clientOrigins: string[];
  maxEventAgeHours: number;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: positiveNumber(env.PORT, 4000),
    mongodbUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    mongodbDb: env.MONGODB_DB ?? 'causalfunnel',
    clientOrigins: (env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxEventAgeHours: positiveNumber(env.MAX_EVENT_AGE_HOURS, 168),
  };
}
