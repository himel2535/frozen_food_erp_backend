import type { Server } from 'socket.io';

let io: Server | null = null;

export function setSocketServer(server: Server) {
  io = server;
}

export function getSocketServer(): Server | null {
  return io;
}

export function companyRoom(tenantId: string) {
  return `tenant:${tenantId || 'default'}`;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

/** Company-wide events only. Do not also emitToUser for the same payload (sockets join both rooms). */
export function emitToCompany(tenantId: string, event: string, payload: unknown) {
  io?.to(companyRoom(tenantId)).emit(event, payload);
}

/** User-specific events only. Do not also emitToCompany for the same payload. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}
