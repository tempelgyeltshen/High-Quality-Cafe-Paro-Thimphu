import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import { StaffUser, Role } from '../src/types/index.ts';

// In-memory token store mapped to staff users with TTL
interface ActiveToken {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const tokens = new Map<string, ActiveToken>();

export function createStaffToken(user: StaffUser): string {
  const token = `hqc_${crypto.randomBytes(24).toString('hex')}`;
  tokens.set(token, {
    token,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  return token;
}

export function revokeStaffToken(token: string): void {
  tokens.delete(token);
}

export function verifyStaffToken(token: string): StaffUser | null {
  if (!token) return null;
  const session = tokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    tokens.delete(token);
    return null;
  }
  const currentStaff = db.getStaffUserById(session.userId);
  if (!currentStaff || !currentStaff.active) {
    tokens.delete(token);
    return null;
  }
  return currentStaff;
}

/**
 * Constant-time token comparison to prevent timing side-channel leaks
 */
export function timingSafeTokenMatch(provided?: string | null, expected?: string | null): boolean {
  if (!provided || !expected) return false;
  const bufA = Buffer.from(String(provided));
  const bufB = Buffer.from(String(expected));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface AuthenticatedRequest extends Request {
  staff?: StaffUser;
}

export function extractRawBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-staff-token']) {
    return String(req.headers['x-staff-token']).trim();
  }
  return '';
}

export function extractStaffFromRequest(req: Request): StaffUser | null {
  const token = extractRawBearerToken(req);
  if (!token) return null;
  return verifyStaffToken(token);
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const staff = extractStaffFromRequest(req);
    if (!staff) {
      return res.status(401).json({ error: 'Unauthorized: Staff authentication required' });
    }

    if (!allowedRoles.includes(staff.role) && staff.role !== 'admin') {
      return res.status(403).json({ error: `Forbidden: Role "${staff.role}" does not have required permissions` });
    }

    req.staff = staff;
    next();
  };
}

/**
 * Lightweight in-memory sliding-window rate limiter per IP + key scope
 */
interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function createRateLimiter(options: { scope: string; maxRequests: number; windowMs: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow authenticated staff (e.g. automated admin compliance verification) without throttling
    if (extractStaffFromRequest(req)) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.scope}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.maxRequests) {
      return res.status(429).json({
        error: options.message || 'Too many requests. Please wait a moment and try again.'
      });
    }

    next();
  };
}
