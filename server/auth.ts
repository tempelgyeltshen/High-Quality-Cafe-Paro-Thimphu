import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import { StaffUser, Role } from '../src/types/index.ts';

// In-memory token store mapped to staff users with TTL
interface ActiveToken {
  token: string;
  user: StaffUser;
  createdAt: number;
  expiresAt: number;
}

const tokens = new Map<string, ActiveToken>();

export function createStaffToken(user: StaffUser): string {
  const token = `hqc_${crypto.randomBytes(24).toString('hex')}`;
  tokens.set(token, {
    token,
    user,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  return token;
}

export function verifyStaffToken(token: string): StaffUser | null {
  const session = tokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    tokens.delete(token);
    return null;
  }
  return session.user;
}

export interface AuthenticatedRequest extends Request {
  staff?: StaffUser;
}

export function extractStaffFromRequest(req: Request): StaffUser | null {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-staff-token']) {
    token = String(req.headers['x-staff-token']).trim();
  }
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
