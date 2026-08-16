import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { disconnectRedis, initRedis } from './lib/redisClient.js';
import { attachSocket } from './realtime/socket.js';

async function main() {
  await connectDatabase();
  await initRedis();

  const app = createApp();
  const httpServer = createServer(app);
  attachSocket(httpServer);
  const server = httpServer.listen(env.port, '0.0.0.0', () => {
    console.log(`[server] Listening on 0.0.0.0:${env.port}`);
    console.log(`[server] Health → /health`);
    console.log(`[server] API    → /api/v1`);
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
