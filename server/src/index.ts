/**
 * Express application entry point — dual mode (Supabase or local JSON).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { Store } from './models/Store';
import { RecommendationService } from './services/RecommendationService';
import { AutocompleteService } from './services/AutocompleteService';
import { SupabaseService } from './services/SupabaseService';
import { authRoutes } from './routes/auth';
import { jobsRoutes } from './routes/jobs';
import { candidateRoutes } from './routes/candidates';
import { miscRoutes } from './routes/autocomplete';

// Some sandboxes export ambient PORT=0 — treat 0/NaN/absent as "use default".
const PORT_ENV = Number(process.env.PORT);
const PORT = Number.isFinite(PORT_ENV) && PORT_ENV > 0 ? PORT_ENV : 4000;
const DATA_DIR = path.join(process.cwd(), 'data');

const store = new Store(DATA_DIR);
const rec = new RecommendationService(store);
const auto = new AutocompleteService(store);
const supabase = new SupabaseService(store);

// Build indexes on boot (skill tries + entity graph).
auto.rebuild();
rec.rebuildGraph();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  // DB ping (json store: verify file readable & collections present)
  let database = 'ok';
  try {
    if (!Array.isArray(store.db.users) || !Array.isArray(store.db.jobs)) throw new Error('collections missing');
  } catch {
    database = 'fail';
  }

  // Supabase ping (only when configured): SELECT 1-equivalent via profiles head
  let supabaseStatus = supabase.enabled ? 'connected' : 'local-mode';
  if (supabase.enabled) {
    supabaseStatus = (await supabase.ping()) ? 'connected' : 'unreachable';
  }

  res.json({
    server: database === 'ok' ? 'ok' : 'degraded',
    database,
    supabase: supabaseStatus,
    authProvider: supabase.enabled ? 'supabase' : 'local',
    service: 'talentmatch-api',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes(store, supabase));
app.use('/api/jobs', jobsRoutes(store, rec, auto, supabase));
app.use('/api/candidates', candidateRoutes(store, rec, auto, supabase));
app.use('/api', miscRoutes(store, rec, auto, supabase));

// 404 for unknown API paths
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`TalentMatch API listening on http://localhost:${PORT} (auth: ${supabase.enabled ? 'supabase' : 'local'})`);
  console.log(`Data dir: ${DATA_DIR}`);
});

// flush pending writes on shutdown
process.on('SIGINT', () => {
  store.close();
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  store.close();
  server.close(() => process.exit(0));
});

export { app, store };
