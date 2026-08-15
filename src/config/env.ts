import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/toys_factory_erp'),
  useMemoryDb: process.env.USE_MEMORY_DB === 'true' || process.env.MONGODB_URI === 'memory',
  corsOrigin:
    process.env.CORS_ORIGIN
    ?? 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001',
  apiKey: process.env.API_KEY ?? '',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  redisUrl: process.env.REDIS_URL ?? '',
};
