/**
 * Auth routes — dual mode.
 *   Supabase configured → signUp/signIn proxy through Supabase Auth and the
 *   returned access token is a Supabase JWT; profile rows are provisioned.
 *   Supabase absent     → local bcrypt + server-issued JWT (offline demo).
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Store } from '../models/Store';
import { makeAuthGuard, signToken, AuthUser } from '../middleware/auth';
import { SupabaseService } from '../services/SupabaseService';
import { User, Role } from '../models/types';

export function authRoutes(store: Store, supabase: SupabaseService | null): Router {
  const r = Router();

  const localToken = (user: User): string => {
    const profile = user.role === 'candidate'
      ? store.db.candidates.find((c) => c.userId === user.id)
      : user.role === 'recruiter'
        ? store.db.recruiters.find((x) => x.userId === user.id)
        : undefined;
    return signToken({ id: user.id, role: user.role, name: user.name, profileId: profile?.id } as AuthUser);
  };

  r.post('/register', async (req: Request, res: Response) => {
    const { email, password, role, name } = req.body ?? {};
    const emailNorm = String(email ?? '').toLowerCase().trim();

    if (!emailNorm || !password || !role || !name) {
      res.status(400).json({ error: 'email, password, role and name are required' });
      return;
    }
    if (!['candidate', 'recruiter', 'admin'].includes(role)) {
      res.status(400).json({ error: 'role must be candidate, recruiter or admin' });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: 'password must be at least 6 characters' });
      return;
    }

    // ---------------- Supabase mode ----------------
    if (supabase?.enabled) {
      const result = await supabase.signUp(emailNorm, String(password), role as Role, String(name).trim());
      if ('error' in result) {
        // 409-style errors surface duplicate accounts
        const status = /already|duplicate|registered/i.test(result.error) ? 409 : 400;
        res.status(status).json({ error: result.error });
        return;
      }
      // Mirror into the local engine index so DSA features work immediately
      if (!store.db.users.some((u) => u.id === result.userId)) {
        const user: User = {
          id: result.userId, email: emailNorm, passwordHash: '-', role: role as Role,
          name: String(name).trim(), createdAt: new Date().toISOString(),
        };
        store.db.users.push(user);
        if (role === 'candidate') {
          store.db.candidates.push({
            id: result.userId, userId: result.userId, name: String(name).trim(),
            headline: '', location: '', education: 'bachelors', experienceYears: 0, skills: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        } else if (role === 'recruiter') {
          store.db.recruiters.push({
            id: result.userId, userId: result.userId, companyName: String(name).trim(),
            industry: '', location: '', about: '', createdAt: new Date().toISOString(),
          });
        } // admins get no role-specific profile row
        store.markDirty();
      }
      const profile = role === 'candidate'
        ? store.db.candidates.find((c) => c.userId === result.userId)
        : store.db.recruiters.find((x) => x.userId === result.userId);
      res.status(201).json({
        token: result.accessToken || signToken({ id: result.userId, role: role as Role, name: String(name).trim(), profileId: profile?.id } as AuthUser),
        user: { id: result.userId, email: emailNorm, role, name: String(name).trim(), profileId: profile?.id ?? result.userId },
        provider: 'supabase',
      });
      return;
    }

    // ---------------- Local mode ----------------
    if (store.db.users.some((u) => u.email === emailNorm)) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    const id = store.nextId('u');
    const user: User = {
      id, email: emailNorm, passwordHash: bcrypt.hashSync(String(password), 10),
      role: role as Role, name: String(name).trim(), createdAt: new Date().toISOString(),
    };
    store.db.users.push(user);

    let profileId = '';
    if (role === 'candidate') {
      profileId = store.nextId('c');
      store.db.candidates.push({
        id: profileId, userId: id, name: user.name, headline: '', location: '',
        education: 'bachelors', experienceYears: 0, skills: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    } else if (role === 'recruiter') {
      profileId = store.nextId('r');
      store.db.recruiters.push({
        id: profileId, userId: id, companyName: String(name).trim(),
        industry: '', location: '', about: '', createdAt: new Date().toISOString(),
      });
    } // admins get no role-specific profile row
    store.markDirty();

    const profile = role === 'candidate'
      ? store.db.candidates.find((c) => c.userId === id)
      : store.db.recruiters.find((x) => x.userId === id);
    res.status(201).json({
      token: signToken({ id, role: user.role, name: user.name, profileId: profile?.id } as AuthUser),
      user: { id, email: emailNorm, role, name: user.name, profileId: profile?.id },
      provider: 'local',
    });
  });

  r.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    const emailNorm = String(email ?? '').toLowerCase().trim();

    // ---------------- Supabase mode ----------------
    if (supabase?.enabled) {
      const result = await supabase.signIn(emailNorm, String(password ?? ''));
      if ('error' in result) {
        res.status(401).json({ error: result.error });
        return;
      }
      const user = store.db.users.find((u) => u.id === result.userId);
      if (user) {
        const profile = user.role === 'candidate'
          ? store.db.candidates.find((c) => c.userId === user.id)
          : user.role === 'recruiter'
            ? store.db.recruiters.find((x) => x.userId === user.id)
            : undefined;
        res.json({
          token: result.accessToken,
          user: { id: user.id, email: user.email, role: user.role, name: user.name, profileId: profile?.id },
          provider: 'supabase',
        });
      } else {
        // valid Supabase session, not mirrored locally — minimal identity
        res.json({
          token: result.accessToken,
          user: { id: result.userId, email: emailNorm, role: 'candidate', name: emailNorm.split('@')[0], profileId: result.userId },
          provider: 'supabase',
        });
      }
      return;
    }

    // ---------------- Local mode ----------------
    const user = store.db.users.find((u) => u.email === emailNorm);
    if (!user || !bcrypt.compareSync(String(password ?? ''), user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const profile = user.role === 'candidate'
      ? store.db.candidates.find((c) => c.userId === user.id)
      : user.role === 'recruiter'
        ? store.db.recruiters.find((x) => x.userId === user.id)
        : undefined;
    res.json({
      token: localToken(user),
      user: { id: user.id, email: user.email, role: user.role, name: user.name, profileId: profile?.id },
      provider: 'local',
    });
  });

  r.get('/me', makeAuthGuard(store, supabase), (req: Request, res: Response) => {
    const user = store.db.users.find((u) => u.id === req.user!.id);
    if (!user) {
      res.json(req.user);
      return;
    }
    res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
  });

  r.post('/logout', (_req: Request, res: Response) => {
    // Stateless tokens: the client discards the session.
    res.json({ ok: true });
  });

  return r;
}
