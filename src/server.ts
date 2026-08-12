import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { disconnectRedis, initRedis } from './lib/redisClient.js';

async function main() {
  await connectDatabase();
  await initRedis();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] Running on http://localhost:${env.port}`);
    console.log(`[server] Health → http://localhost:${env.port}/health`);
    console.log(`[server] API    → http://localhost:${env.port}/api/v1`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[server] ${signal} received — shutting down`);
    server.close(async () => {
      await disconnectRedis();
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
