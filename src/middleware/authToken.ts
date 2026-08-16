import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export type AuthUser = {
  _id: unknown;
  status?: string;
  role?: string;
  tenantId?: string;
  email?: string;
  name?: string;
};

function parseCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

function bearerToken(authorization: string | string[] | undefined): string | undefined {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (header?.startsWith('Bearer ')) return header.substring(7).trim() || undefined;
  return undefined;
}

export function extractAccessTokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.token ?? parseCookieValue(req.headers.cookie, 'token');
  if (typeof cookieToken === 'string' && cookieToken.trim()) return cookieToken.trim();
  return bearerToken(req.header('authorization'));
}

export function extractAccessTokenFromHandshake(handshake: {
  auth?: { token?: unknown };
  headers: { cookie?: string; authorization?: string | string[] };
}): string | undefined {
  const authToken = handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
  const fromHeader = bearerToken(handshake.headers.authorization);
  if (fromHeader) return fromHeader;
  return parseCookieValue(handshake.headers.cookie, 'token');
}

export async function authenticateAccessToken(token: string): Promise<AuthUser> {
  const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';
  const decoded = jwt.verify(token, secret) as { userId: string; tenantId?: string };
  const user = await User.findById(decoded.userId).lean();
  if (!user || (user as { status?: string }).status === 'disabled') {
    throw new Error('Unauthorized: User not found or disabled');
  }
  const authUser = user as AuthUser;
  if (!authUser.tenantId && decoded.tenantId) {
    authUser.tenantId = decoded.tenantId;
  }
  return authUser;
}
