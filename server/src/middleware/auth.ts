/**
 * Auth middleware — dual mode.
 *   Supabase configured: verifies Supabase access tokens (JWKS/introspection)
 *   Supabase absent:     verifies the server's own JWTs (local demo mode)
 * In both cases req.user = { id, role, name, profileId } resolved from the store.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Store } from '../models/Store';
import { SupabaseService } from '../services/SupabaseService';

const JWT_SECRET = process.env.JWT_SECRET || 'talentmatch-dev-secret-change-me';

export interface AuthUser {
  id: string;      // profile id (uuid in supabase mode, u# in local mode)
  role: 'candidate' | 'recruiter' | 'admin';
  name: string;
  profileId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function makeAuthGuard(store: Store, supabase: SupabaseService | null) {
  return function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const resolve = async () => {
      // ---------- Supabase path ----------
      if (supabase?.enabled) {
        const verified = await supabase.verifyAccessToken(token);
        if (verified) {
          const localUser = store.db.users.find((u) => u.id === verified.userId);
          if (localUser) {
            const profile = localUser.role === 'candidate'
              ? store.db.candidates.find((c) => c.userId === localUser.id)
              : store.db.recruiters.find((r) => r.userId === localUser.id);
            if (profile) {
              req.user = { id: localUser.id, role: localUser.role, name: localUser.name, profileId: profile.id };
              return true;
            }
          }
          // Auth-valid but not seeded locally → generic identity (profile rows live in Supabase)
          req.user = { id: verified.userId, role: 'candidate', name: verified.email, profileId: verified.userId };
          return true;
        }
      }

      // ---------- Local JWT path ----------
      try {
        const claims = jwt.verify(token, JWT_SECRET) as AuthUser;
        // Accept legacy tokens that carry role/name directly
        if (claims && (claims.role === 'candidate' || claims.role === 'recruiter')) {
          req.user = claims;
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    resolve()
      .then((ok) => {
        if (ok) next();
        else res.status(401).json({ error: 'Invalid or expired token' });
      })
      .catch(() => res.status(401).json({ error: 'Invalid or expired token' }));
  };
}

export function requireRole(...roles: Array<'candidate' | 'recruiter' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
      return;
    }
    next();
  };
}
