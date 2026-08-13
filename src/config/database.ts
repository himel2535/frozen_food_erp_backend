import dns from 'node:dns';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.js';
import { resolveMongoUri, sanitizeMongoUri } from './mongo-uri.js';

// Prefer IPv4 — helps Atlas on some Windows networks
dns.setDefaultResultOrder('ipv4first');

let memoryServer: MongoMemoryServer | null = null;

declare global {
  // Reuse one Mongoose connection across hot reloads in dev.
  // eslint-disable-next-line no-var
  var __mongooseConnected: boolean | undefined;
}

function printMongoSetupHelp() {
  console.error(`
[db] MongoDB is not running on ${env.mongoUri}

Fix options (pick one):

  A) Quick dev (no install) — in .env set:
       USE_MEMORY_DB=true
     then: npm run dev

  B) Install MongoDB locally (Windows):
       https://www.mongodb.com/try/download/community
       Then start service "MongoDB" from Services app.

  C) MongoDB Atlas (free cloud):
       Create cluster → Connect → copy URI into .env:
       MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/toys_factory_erp

  D) querySrv / DNS errors (Atlas on Windows):
       Restart after pulling latest backend — SRV is auto-resolved via public DNS.
       Or in Atlas Connect choose "Standard connection string" (mongodb://… not srv).
`);
}

export async function connectDatabase(): Promise<void> {
  if (global.__mongooseConnected && mongoose.connection.readyState === 1) {
    return;
  }

  mongoose.set('strictQuery', true);

  let uri = env.mongoUri;

  if (env.useMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    console.log('[db] Using in-memory MongoDB (dev only — data resets on restart)');
  }

  try {
    if (!env.useMemoryDb && !env.isProd && uri.startsWith('mongodb+srv://')) {
      uri = await resolveMongoUri(uri);
      console.log(`[db] Resolved Atlas SRV → ${sanitizeMongoUri(uri)}`);
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: env.useMemoryDb ? 30000 : 20000,
      maxPoolSize: 20,
    });
    global.__mongooseConnected = true;
    console.log(`[db] MongoDB connected${env.useMemoryDb ? '' : ` → ${sanitizeMongoUri(env.mongoUri)}`}`);

    const { ensureDatabaseIndexes } = await import('./ensureIndexes.js');
    await ensureDatabaseIndexes();
  } catch (err) {
    const message = String(err);
    const code = (err as { cause?: { code?: string } })?.cause?.code
      ?? (err as { code?: string })?.code;
    const isConnectionFailure = code === 'ECONNREFUSED'
      || message.includes('ECONNREFUSED')
      || message.includes('querySrv');
    if (!env.useMemoryDb && isConnectionFailure) {
      printMongoSetupHelp();
    }
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  global.__mongooseConnected = false;
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  console.log('[db] MongoDB disconnected');
}
