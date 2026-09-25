/**
 * SUPABASE SERVICE
 * ----------------------------------------------------------------------------
 * When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or anon key) are configured,
 * the backend upgrades to "supabase mode":
 *
 *   - Auth     : Supabase Auth (GoTrue) issues sessions. The server verifies
 *                Supabase access tokens (JWKS) instead of its own JWTs, and
 *                login/signup proxy through Supabase so the same account works
 *                in the dashboard and via the API.
 *   - Database : every user-facing mutation is written through to Supabase
 *                (profiles, candidates, recruiters, jobs, applications,
 *                saved_jobs, roadmaps, recommendations) while the local JSON
 *                store remains the DSA engine's fast in-memory index.
 *
 * Without those env vars, the app runs fully offline (DB_MODE=json) — the
 * demo keeps working without a Supabase project.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { Store } from '../models/Store';
import { User, Candidate, Recruiter, Job, Application, SavedJob, RoadmapRecord, Role } from '../models/types';

export function getSupabaseConfig(): { url: string; serviceKey: string; enabled: boolean } {
  const url = process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  return { url, serviceKey, enabled: !!(url && serviceKey) };
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private admin: SupabaseClient | null = null;
  readonly enabled: boolean;
  private jwksCache: { keys: crypto.KeyObject[]; fetchedAt: number } | null = null;

  constructor(private store: Store) {
    const { url, serviceKey, enabled } = getSupabaseConfig();
    this.enabled = enabled;
    if (enabled) {
      // anon client (user-context operations)
      this.client = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // service-role client (bypasses RLS for engine writes)
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        this.admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      }
      console.log('[supabase] mode enabled →', url);
    } else {
      console.log('[supabase] not configured — running in local JSON mode');
    }
  }

  /** Lightweight connectivity probe used by /api/health. */
  async ping(): Promise<boolean> {
    const client = (this.admin ?? this.client) as SupabaseClient | null;
    if (!client) return false;
    try {
      const { error } = await client.from('profiles').select('id', { count: 'exact', head: true });
      return !error;
    } catch {
      return false;
    }
  }

  /** Verify auth connectivity (used by tests / setup doctor). */
  async authCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.auth.getSession();
      return !error;
    } catch {
      return false;
    }
  }

  // ------------------------------------------------------------------- auth

  /** Sign up via Supabase Auth; provision profile + role row. */
  async signUp(email: string, password: string, role: Role, name: string):
    Promise<{ userId: string; email: string; accessToken: string; refreshToken: string } | { error: string }> {
    if (!this.client) return { error: 'Supabase not configured' };
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return { error: error.message };
    const userId = data.user?.id;
    if (!userId) return { error: 'Supabase sign-up returned no user (email confirmation may be required)' };

    // Confirm immediately when using service role (demo convenience)
    if (this.admin) {
      await this.admin.auth.admin.updateUserById(userId, { email_confirm: true });
    }

    await this.provisionProfile(userId, role, name);
    const accessToken = data.session?.access_token ?? '';
    const refreshToken = data.session?.refresh_token ?? '';
    return { userId, email, accessToken, refreshToken };
  }

  /** Sign in via Supabase Auth. */
  async signIn(email: string, password: string):
    Promise<{ userId: string; email: string; accessToken: string; refreshToken: string } | { error: string }> {
    if (!this.client) return { error: 'Supabase not configured' };
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const userId = data.user?.id;
    if (!userId) return { error: 'Supabase sign-in returned no user' };
    await this.ensureProvisioned(userId, data.user?.email ?? email);
    return { userId, email, accessToken: data.session?.access_token ?? '', refreshToken: data.session?.refresh_token ?? '' };
  }

  /** Create profile + role-specific row if missing. */
  private async provisionProfile(userId: string, role: Role, name: string): Promise<void> {
    if (!this.admin) return;
    const { data: existing } = await this.admin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (existing) return;

    await this.admin.from('profiles').insert({ id: userId, role, full_name: name });

    if (role === 'candidate') {
      await this.admin.from('candidates').insert({ profile_id: userId, headline: '', location: '' });
    } else if (role === 'recruiter') {
      await this.admin.from('recruiters').insert({ profile_id: userId, company_name: name, industry: '', location: '' });
    } // admins: profiles row only
  }

  /** Ensure a signing-in user has profile rows (self-heal for pre-seeded users). */
  private async ensureProvisioned(userId: string, email: string): Promise<void> {
    if (!this.admin) return;
    const { data: profile } = await this.admin.from('profiles').select('id, role, full_name').eq('id', userId).maybeSingle();
    if (!profile) {
      // user exists in auth but has no profile — create one as candidate by default
      await this.provisionProfile(userId, 'candidate', email.split('@')[0]);
      return;
    }
    if (profile.role === 'candidate') {
      const { data: c } = await this.admin.from('candidates').select('id').eq('profile_id', userId).maybeSingle();
      if (!c) await this.admin.from('candidates').insert({ profile_id: userId });
    } else {
      const { data: r } = await this.admin.from('recruiters').select('id').eq('profile_id', userId).maybeSingle();
      if (!r) await this.admin.from('recruiters').insert({ profile_id: userId, company_name: profile.full_name });
    }
  }

  /**
   * Verify a Supabase access token against the project's JWKS and return the
   * user id (sub). Falls back to /auth/v1/user introspection when JWKS fails.
   */
  async verifyAccessToken(token: string): Promise<{ userId: string; email: string } | null> {
    if (!this.enabled) return null;

    // 1) JWKS path (asymmetric keys, projects from 2024+)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
        const sigB64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
        const signature = Buffer.from(sigB64, 'base64');
        const jwks = await this.getJwks();
        for (const key of jwks) {
          try {
            const ok = crypto.verify('RS256', signed, key, signature);
            if (!ok) continue;
            const claims = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
            if (claims.sub && String(claims.iss ?? '').includes(new URL(getSupabaseConfig().url).host)) {
              return { userId: claims.sub, email: claims.email ?? '' };
            }
          } catch { /* try next key */ }
        }
      }
    } catch { /* fall through to introspection */ }

    // 2) Introspection fallback
    if (this.client) {
      const { data, error } = await this.client.auth.getUser(token);
      if (!error && data.user) return { userId: data.user.id, email: data.user.email ?? '' };
    }
    return null;
  }

  private async getJwks(): Promise<crypto.KeyObject[]> {
    const now = Date.now();
    if (this.jwksCache && now - this.jwksCache.fetchedAt < 3600_000) return this.jwksCache.keys;
    const url = new URL('/auth/v1/keys', getSupabaseConfig().url).toString();
    const res = await fetch(url, { headers: { apikey: getSupabaseConfig().serviceKey } });
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const body = (await res.json()) as { keys: Array<{ kty: string; n: string; e: string }> };
    const keys = body.keys
      .filter((k) => k.kty === 'RSA')
      .map((k) => crypto.createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' }));
    this.jwksCache = { keys, fetchedAt: now };
    return keys;
  }

  // -------------------------------------------------------------- write-through

  /** Push the whole local store to Supabase (used by the seed script). */
  async pushAll(): Promise<{ ok: boolean; error?: string }> {
    if (!this.admin) return { ok: false, error: 'Supabase not configured (need service role key)' };
    const db = this.store.db;
    try {
      // profiles
      const profiles = db.users.map((u) => ({
        id: u.id, role: u.role, full_name: u.name,
      }));
      const p = await this.admin.from('profiles').upsert(profiles);
      if (p.error) throw p.error;

      // candidates
      const cands = db.candidates.map((c) => ({
        id: c.id, profile_id: c.userId, headline: c.headline ?? '', location: c.location ?? '',
        education: c.education, experience_years: c.experienceYears, skills: c.skills,
        resume_text: c.resumeText ?? null, resume_file_name: c.resumeFileName ?? null,
        github_url: c.githubUrl ?? null, linkedin_url: c.linkedinUrl ?? null, phone: c.phone ?? null,
      }));
      const c = await this.admin.from('candidates').upsert(cands);
      if (c.error) throw c.error;

      // recruiters
      const recs = db.recruiters.map((r) => ({
        id: r.id, profile_id: r.userId, company_name: r.companyName, industry: r.industry ?? '',
        location: r.location ?? '', about: r.about ?? '', website: r.website ?? null,
      }));
      const r = await this.admin.from('recruiters').upsert(recs);
      if (r.error) throw r.error;

      // jobs
      const jobs = db.jobs.map((j) => ({
        id: j.id, recruiter_id: j.recruiterId, title: j.title, description: j.description,
        location: j.location, work_mode: j.workMode, salary_min: j.salaryMin ?? null,
        salary_max: j.salaryMax ?? null, min_education: j.minEducation,
        min_experience_years: j.minExperienceYears, required_skills: j.requiredSkills,
        active: j.active, posted_at: j.postedAt,
      }));
      const jj = await this.admin.from('jobs').upsert(jobs);
      if (jj.error) throw jj.error;

      // applications
      if (db.applications.length) {
        const apps = db.applications.map((a) => ({
          id: a.id, job_id: a.jobId, candidate_id: a.candidateId, match_score: a.matchScore,
          status: a.status, note: a.note ?? null, applied_at: a.appliedAt,
        }));
        const aa = await this.admin.from('applications').upsert(apps);
        if (aa.error) throw aa.error;
      }

      // saved_jobs
      if (db.savedJobs.length) {
        const sv = db.savedJobs.map((s) => ({
          id: s.id, candidate_id: s.candidateId, job_id: s.jobId, saved_at: s.savedAt,
        }));
        const ss = await this.admin.from('saved_jobs').upsert(sv);
        if (ss.error) throw ss.error;
      }

      // roadmaps
      if (db.roadmaps.length) {
        const rm = db.roadmaps.map((m) => ({
          id: m.id, candidate_id: m.candidateId, job_id: m.jobId,
          target_job_title: m.targetJobTitle, current_match_score: m.currentMatchScore,
          total_months: m.totalMonths, payload: m.payload, generated_at: m.generatedAt,
        }));
        const rr = await this.admin.from('roadmaps').upsert(rm);
        if (rr.error) throw rr.error;
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Persist a single recommendation run (engine → Supabase). */
  async logRecommendation(profileId: string, kind: 'jobs-for-candidate' | 'candidates-for-job' | 'similar-jobs',
    refId: string, topScore: number, items: unknown[], algorithm: string): Promise<void> {
    if (!this.admin) return;
    await this.admin.from('recommendations').insert({
      profile_id: profileId, kind, ref_id: refId, top_score: topScore,
      items, algorithm, generated_at: new Date().toISOString(),
    });
  }

  /** Persist a generated roadmap (engine → Supabase + local mirror). */
  async saveRoadmap(rec: RoadmapRecord): Promise<void> {
    // local mirror
    const existing = this.store.db.roadmaps.find((m) => m.candidateId === rec.candidateId && m.jobId === rec.jobId);
    if (existing) {
      Object.assign(existing, rec);
    } else {
      this.store.db.roadmaps.push(rec);
    }
    this.store.markDirty();

    if (!this.admin) return;
    await this.admin.from('roadmaps').upsert({
      id: rec.id, candidate_id: rec.candidateId, job_id: rec.jobId,
      target_job_title: rec.targetJobTitle, current_match_score: rec.currentMatchScore,
      total_months: rec.totalMonths, payload: rec.payload, generated_at: rec.generatedAt,
    });
  }
}
