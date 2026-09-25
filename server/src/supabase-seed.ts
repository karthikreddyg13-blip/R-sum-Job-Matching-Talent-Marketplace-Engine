/**
 * SUPABASE SEED
 * ----------------------------------------------------------------------------
 * 1. Creates the 26 demo auth users (6 recruiters + 20 candidates) in Supabase
 *    Auth via the service-role admin API (password: password123).
 * 2. Rekeys the local store's user ids to the Supabase UUIDs so the local DSA
 *    index and the cloud rows reference the same identities.
 * 3. Pushes all entities (profiles, candidates, recruiters, jobs,
 *    applications, saved_jobs) through SupabaseService.pushAll().
 *
 * Run AFTER applying migrations/0001_init.sql:
 *   npm run seed:supabase
 *
 * Re-runnable: existing auth users are looked up by email instead of duplicated.
 */

import 'dotenv/config';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Store } from './models/Store';
import { SupabaseService, getSupabaseConfig } from './services/SupabaseService';

const { url, serviceKey, enabled } = getSupabaseConfig();
if (!enabled || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_PASSWORD = 'password123';
const store = new Store(path.join(process.cwd(), 'data'));

if (store.db.users.length === 0) {
  console.error('Local store is empty — run `npm run seed` first.');
  process.exit(1);
}

async function ensureAuthUser(email: string, name: string): Promise<string | null> {
  // existing?
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    console.error(`  ! failed to create ${email}: ${error.message}`);
    return null;
  }
  return data.user?.id ?? null;
}

async function main(): Promise<void> {
  const idMap = new Map<string, string>(); // old local user id -> supabase uuid

  for (const user of store.db.users) {
    const uuid = await ensureAuthUser(user.email, user.name);
    if (!uuid) continue;
    idMap.set(user.id, uuid);
    user.id = uuid;
    user.passwordHash = '-';
  }

  // rekey references
  for (const c of store.db.candidates) c.userId = idMap.get(c.userId) ?? c.userId;
  for (const r of store.db.recruiters) r.userId = idMap.get(r.userId) ?? r.userId;

  store.saveNow();

  const supabase = new SupabaseService(store);
  const pushed = await supabase.pushAll();
  if (!pushed.ok) {
    console.error('Push failed:', pushed.error);
    process.exit(1);
  }

  console.log('Supabase seed complete:');
  console.log(`  auth users: ${idMap.size}/${store.db.users.length}`);
  console.log(`  profiles/candidates/recruiters/jobs/applications/saved_jobs pushed`);
  console.log('Demo logins (password123): karthik@example.com · aarav@example.com · hr@nimbussoft.com');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
