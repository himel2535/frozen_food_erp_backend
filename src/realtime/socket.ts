import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import {
  authenticateAccessToken,
  extractAccessTokenFromHandshake,
} from '../middleware/authToken.js';
import { companyRoom, setSocketServer, userRoom } from './emit.js';

export const NOTIFICATION_NEW_EVENT = 'notification:new';

export function attachSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin.split(',').map((origin) => origin.trim()),
      credentials: true,
    },
  });

  setSocketServer(io);

  io.use(async (socket, next) => {
    try {
      const token = extractAccessTokenFromHandshake(socket.handshake);
      if (!token) {
        next(new Error('Unauthorized: Missing or invalid token'));
        return;
      }
      socket.data.user = await authenticateAccessToken(token);
      next();
    } catch {
      next(new Error('Unauthorized: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Frontend must refetch GET /api/v1/notifications on connect/reconnect.
    // Socket messages can be missed while the client is disconnected.
    const user = socket.data.user as { _id?: unknown; tenantId?: string } | undefined;
    const userId = String(user?._id ?? '');
    const tenantId = String(user?.tenantId ?? 'default');
    if (tenantId) socket.join(companyRoom(tenantId));
    if (userId) socket.join(userRoom(userId));
  });

  return io;
}
