/**
 * Autocomplete (Trie), Analytics (DSA metrics) and Applications routes.
 */

import { Router, Request, Response } from 'express';
import { Store } from '../models/Store';
import { makeAuthGuard, requireRole } from '../middleware/auth';
import { SupabaseService } from '../services/SupabaseService';
import { AutocompleteService, AutocompleteKind } from '../services/AutocompleteService';
import { RecommendationService } from '../services/RecommendationService';
import { MaxHeap } from '../dsa/MaxHeap';
import { linearSearch, binarySearch, jumpSearch } from '../dsa/Searching';
import { quickSort, mergeSort, bubbleSort } from '../dsa/Sorting';

export function miscRoutes(store: Store, rec: RecommendationService, auto: AutocompleteService,
  supabase: SupabaseService | null): Router {
  const r = Router();
  const requireAuth = makeAuthGuard(store, supabase);

  // ---------- Trie autocomplete: /api/autocomplete?kind=skill&q=pyt ----------
  r.get('/autocomplete', (req: Request, res: Response) => {
    const kind = (req.query.kind as AutocompleteKind) || 'skill';
    const q = String(req.query.q ?? '');
    if (!['skill', 'job', 'company'].includes(kind)) {
      res.status(400).json({ error: 'kind must be skill, job or company' });
      return;
    }
    const start = Date.now();
    const suggestions = auto.suggest(kind, q, 8);
    res.json({
      suggestions,
      meta: { kind, prefix: q, timeMs: Date.now() - start, structure: 'trie' },
    });
  });

  // ---------- Analytics: platform stats ----------
  r.get('/analytics/overview', (_req: Request, res: Response) => {
    const db = store.db;
    const scores = db.applications.map((a) => a.matchScore);
    const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0;

    res.json({
      users: db.users.length,
      candidates: db.candidates.length,
      recruiters: db.recruiters.length,
      jobs: db.jobs.length,
      applications: db.applications.length,
      avgApplicationMatch: Math.round(avg * 10) / 10,
      topSkills: topSkills(db.candidates.flatMap((c) => c.skills), 10),
      demandedSkills: topSkills(db.jobs.flatMap((j) => j.requiredSkills.map((s) => s.name)), 10),
      applicationsByStatus: db.applications.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1;
        return acc;
      }, {}),
    });
  });

  // ---------- Analytics: DSA benchmark playground ----------
  r.get('/analytics/dsa', (req: Request, res: Response) => {
    const n = Math.min(20000, Math.max(100, parseInt(String(req.query.n ?? '2000'), 10) || 2000));
    const arr = Array.from({ length: n }, (_, i) => ({ id: `x${i}`, key: (i * 37) % n }));
    const sorted = [...arr].sort((a, b) => a.key - b.key);
    const target = sorted[Math.floor(n / 2)].key;

    const linear = linearSearch(arr, (x) => x.key === target);
    const bin = binarySearch(sorted, target, (x) => x.key);
    const jump = jumpSearch(sorted, target, (x) => x.key);

    const qs = quickSort(arr, (a, b) => a.key - b.key);
    const ms = mergeSort(arr, (a, b) => a.key - b.key);
    const bs = bubbleSort(arr.slice(0, Math.min(n, 3000)), (a, b) => a.key - b.key);

    const heapItems = arr.map((x) => ({ id: x.id, score: x.key }));
    const heapStart = Date.now();
    MaxHeap.topK(heapItems, 10);
    const heapMs = Date.now() - heapStart;

    res.json({
      n,
      search: {
        linear: { comparisons: linear.comparisons, timeMs: 0, complexity: 'O(n)' },
        binary: { comparisons: bin.comparisons, timeMs: 0, complexity: 'O(log n)' },
        jump: { comparisons: jump.comparisons, timeMs: 0, complexity: 'O(√n)' },
      },
      sort: {
        quickSort: { comparisons: qs.metrics.comparisons, swaps: qs.metrics.swaps, timeMs: qs.metrics.timeMs, complexity: 'O(n log n) avg' },
        mergeSort: { comparisons: ms.metrics.comparisons, swaps: ms.metrics.swaps, timeMs: ms.metrics.timeMs, complexity: 'O(n log n)' },
        bubbleSort: { comparisons: bs.metrics.comparisons, swaps: bs.metrics.swaps, timeMs: bs.metrics.timeMs, complexity: 'O(n²)' },
      },
      heap: { topK10: { timeMs: heapMs, complexity: 'O(n + k log n)' } },
    });
  });

  // ---------- Applications ----------
  r.get('/applications', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const apps = store.db.applications.filter((a) => a.candidateId === candidate.id);
    const items = apps.map((a) => ({
      ...a,
      job: store.db.jobs.find((j) => j.id === a.jobId) ?? null,
    }));
    res.json({ items });
  });

  // ---------- Graph snapshot for visualization ----------
  r.get('/graph', (_req: Request, res: Response) => {
    res.json(rec.graphSnapshot());
  });

  return r;
}

function topSkills(all: string[], limit: number): Array<{ skill: string; count: number }> {
  const counts: Map<string, number> = new Map();
  for (const raw of all) {
    const key = raw.toLowerCase().trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
