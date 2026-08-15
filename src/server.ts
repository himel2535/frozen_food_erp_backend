import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { disconnectRedis, initRedis } from './lib/redisClient.js';
import { attachSocket } from './realtime/socket.js';

import { Customer, Invoice } from './models/index.js';

async function recalculateAllCustomerDues() {
  console.log('[db-sync] Recalculating all customer dues from invoices...');
  try {
    const customers = await Customer.find({});
    for (const customer of customers) {
      const customerIds = [customer._id.toString()];
      if (customer.legacyId) customerIds.push(customer.legacyId);

      const aggregateResult = await Invoice.aggregate([
        { $match: { tenantId: customer.tenantId, customerId: { $in: customerIds }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalDue: { $sum: '$due' } } }
      ]);
      const totalDue = aggregateResult[0]?.totalDue ?? 0;
      if (customer.totalDue !== totalDue) {
        await Customer.updateOne(
          { _id: customer._id },
          { $set: { totalDue } }
        );
        console.log(`[db-sync] Updated customer "${customer.name}" due to: ৳${totalDue}`);
      }
    }
    console.log('[db-sync] Finished recalculating customer dues.');
  } catch (err) {
    console.error('[db-sync] Failed to recalculate customer dues:', err);
  }
}

async function main() {
  await connectDatabase();
  await recalculateAllCustomerDues();
  await initRedis();

  const app = createApp();
  const httpServer = createServer(app);
  attachSocket(httpServer);
  const server = httpServer.listen(env.port, () => {
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
