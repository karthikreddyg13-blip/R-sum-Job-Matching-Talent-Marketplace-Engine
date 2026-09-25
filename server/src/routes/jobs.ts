/**
 * Jobs, search, matching, skill-gap, saved jobs, applicants and roadmaps.
 * All ranked lists are produced by the DSA layer (heap top-k / quickSort).
 */

import { Router, Request, Response } from 'express';
import { Store } from '../models/Store';
import { makeAuthGuard, requireRole, AuthUser } from '../middleware/auth';
import { RecommendationService } from '../services/RecommendationService';
import { AutocompleteService } from '../services/AutocompleteService';
import { SupabaseService } from '../services/SupabaseService';
import { SortKey } from '../dsa/Sorting';
import { Job, SkillRequirement, EducationLevel } from '../models/types';

export function jobsRoutes(store: Store, rec: RecommendationService, auto: AutocompleteService,
  supabase: SupabaseService | null): Router {
  const r = Router();
  const requireAuth = makeAuthGuard(store, supabase);

  // ---------- public: list + search jobs ----------
  r.get('/', (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').toLowerCase().trim();
    let jobs = store.db.jobs.filter((j) => j.active);
    if (q) {
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q) ||
          j.requiredSkills.some((s) => s.name.toLowerCase().includes(q))
      );
    }
    const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
    const key = req.query.sort === 'salary' ? 'salaryMax' : 'postedAt';
    const sorted = [...jobs].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key] ?? 0;
      const bv = (b as unknown as Record<string, unknown>)[key] ?? 0;
      const cmp = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : (av as number) - (bv as number);
      return dir === 'desc' ? -cmp : cmp;
    });
    res.json({ items: sorted, count: sorted.length });
  });

  // ---------- candidate: ranked job recommendations (MaxHeap top-k) ----------
  r.get('/recommendations', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const k = Math.min(25, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const top = rec.topJobsForCandidate(candidate.id, k);

    // persist a recommendation log (local + supabase write-through)
    supabase?.logRecommendation(
      req.user!.id, 'jobs-for-candidate', candidate.id,
      top[0]?.match.score ?? 0, top.map((t) => ({ jobId: t.job.id, score: t.match.score })),
      'weighted-score + maxheap top-k'
    );

    res.json({
      items: top.map((rj) => ({
        job: rj.job,
        score: rj.match.score,
        breakdown: rj.match.breakdown,
        matchedSkills: rj.match.matchedSkills,
        missingRequired: rj.match.missingRequired,
        missingPreferred: rj.match.missingPreferred,
      })),
      algorithm: 'weighted match score -> MaxHeap top-k',
      generatedAt: new Date().toISOString(),
    });
  });

  // ---------- candidate: full ranked + sorted list (search page) ----------
  r.get('/ranked', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const { items, metrics } = rec.rankedJobsForCandidate(candidate.id, {
      q: req.query.q as string,
      sort: (req.query.sort as SortKey) || 'matchScore',
      dir: (req.query.dir as 'asc' | 'desc') || 'desc',
      limit: 50,
    });
    // Flatten to the same contract as /recommendations so the UI has one shape:
    // { job, score, breakdown, matchedSkills, missingRequired, missingPreferred }
    const uiItems = items.map((rj) => ({
      job: rj.job,
      score: rj.match.score,
      breakdown: rj.match.breakdown,
      matchedSkills: rj.match.matchedSkills,
      missingRequired: rj.match.missingRequired,
      missingPreferred: rj.match.missingPreferred,
      matchScore: rj.match.score,
      skillCount: rj.job.requiredSkills.length,
    }));
    res.json({ items: uiItems, sortMetrics: metrics, algorithm: 'weighted match score -> quickSort' });
  });

  // ---------- candidate: saved jobs list ----------
  r.get('/saved', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const saved = store.db.savedJobs.filter((s) => s.candidateId === candidate.id);
    const items = saved
      .map((s) => {
        const job = store.db.jobs.find((j) => j.id === s.jobId);
        return job ? { savedAt: s.savedAt, job } : null;
      })
      .filter((x): x is { savedAt: string; job: Job } => x !== null);
    res.json({ items });
  });

  // ---------- recruiter: post a job ----------
  r.post('/', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const recruiter = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!recruiter) {
      res.status(404).json({ error: 'Recruiter profile not found' });
      return;
    }
    const b = req.body ?? {};
    const requiredSkills: SkillRequirement[] = Array.isArray(b.requiredSkills)
      ? b.requiredSkills.map((s: { name: string; weight?: number }) => ({
          name: String(s.name).trim(),
          weight: Math.min(5, Math.max(1, s.weight ?? 3)),
        }))
      : [];
    if (!b.title || requiredSkills.length === 0) {
      res.status(400).json({ error: 'title and at least one required skill are required' });
      return;
    }

    const job: Job = {
      id: store.nextId('j'),
      recruiterId: recruiter.id,
      title: String(b.title).trim(),
      description: String(b.description ?? ''),
      location: String(b.location ?? ''),
      workMode: (['onsite', 'remote', 'hybrid'].includes(b.workMode) ? b.workMode : 'onsite') as Job['workMode'],
      salaryMin: b.salaryMin ? Number(b.salaryMin) : undefined,
      salaryMax: b.salaryMax ? Number(b.salaryMax) : undefined,
      requiredSkills,
      minEducation: (['none', 'diploma', 'bachelors', 'masters', 'phd'].includes(b.minEducation)
        ? b.minEducation
        : 'bachelors') as EducationLevel,
      minExperienceYears: Number(b.minExperienceYears ?? 0),
      postedAt: new Date().toISOString(),
      active: true,
    };
    store.db.jobs.push(job);
    store.markDirty();
    rec.rebuildGraph();
    auto.rebuild();
    res.status(201).json(job);
  });

  // ---------- recruiter: edit own job ----------
  r.put('/:id', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const recruiter = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!job || !recruiter || job.recruiterId !== recruiter.id) {
      res.status(404).json({ error: 'Job not found (or not yours)' });
      return;
    }
    const b = req.body ?? {};
    if (b.title !== undefined) job.title = String(b.title).trim();
    if (b.description !== undefined) job.description = String(b.description);
    if (b.location !== undefined) job.location = String(b.location);
    if (b.workMode !== undefined && ['onsite', 'remote', 'hybrid'].includes(b.workMode)) job.workMode = b.workMode;
    if (b.salaryMin !== undefined) job.salaryMin = b.salaryMin ? Number(b.salaryMin) : undefined;
    if (b.salaryMax !== undefined) job.salaryMax = b.salaryMax ? Number(b.salaryMax) : undefined;
    if (b.minEducation !== undefined && ['none', 'diploma', 'bachelors', 'masters', 'phd'].includes(b.minEducation)) {
      job.minEducation = b.minEducation as EducationLevel;
    }
    if (b.minExperienceYears !== undefined) job.minExperienceYears = Math.max(0, Number(b.minExperienceYears) || 0);
    if (b.active !== undefined) job.active = Boolean(b.active);
    if (Array.isArray(b.requiredSkills) && b.requiredSkills.length > 0) {
      job.requiredSkills = b.requiredSkills.map((s: { name: string; weight?: number }) => ({
        name: String(s.name).trim(),
        weight: Math.min(5, Math.max(1, s.weight ?? 3)),
      }));
    }
    store.markDirty();
    rec.rebuildGraph();
    auto.rebuild();
    res.json(job);
  });

  // ---------- recruiter: delete own job ----------
  r.delete('/:id', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const recruiter = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    const idx = store.db.jobs.findIndex((j) => j.id === req.params.id);
    if (idx === -1 || !recruiter || store.db.jobs[idx].recruiterId !== recruiter.id) {
      res.status(404).json({ error: 'Job not found (or not yours)' });
      return;
    }
    const jobId = store.db.jobs[idx].id;
    store.db.jobs.splice(idx, 1);
    // cascade locally (Supabase FKs cascade automatically)
    store.db.applications = store.db.applications.filter((a) => a.jobId !== jobId);
    store.db.savedJobs = store.db.savedJobs.filter((s) => s.jobId !== jobId);
    store.db.roadmaps = store.db.roadmaps.filter((m) => m.jobId !== jobId);
    store.markDirty();
    rec.rebuildGraph();
    auto.rebuild();
    res.json({ ok: true, deleted: jobId });
  });

  // ---------- public: single job + similar jobs (graph BFS) ----------
  r.get('/:id', (req: Request, res: Response) => {
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const similar = rec.similarJobs(job.id, 5);
    res.json({ job, similar });
  });

  // ---------- candidate: save / unsave ----------
  r.post('/:id/save', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!candidate || !job) {
      res.status(404).json({ error: 'Job or candidate not found' });
      return;
    }
    if (!store.db.savedJobs.some((s) => s.jobId === job.id && s.candidateId === candidate.id)) {
      store.db.savedJobs.push({
        id: store.nextId('s'), candidateId: candidate.id, jobId: job.id,
        savedAt: new Date().toISOString(),
      });
      store.markDirty();
    }
    res.status(201).json({ ok: true, saved: true });
  });

  r.delete('/:id/save', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    store.db.savedJobs = store.db.savedJobs.filter(
      (s) => !(s.jobId === req.params.id && s.candidateId === candidate.id)
    );
    store.markDirty();
    res.json({ ok: true, saved: false });
  });

  // ---------- candidate: apply ----------
  r.post('/:id/apply', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!candidate || !job) {
      res.status(404).json({ error: 'Job or candidate not found' });
      return;
    }
    if (store.db.applications.some((a) => a.jobId === job.id && a.candidateId === candidate.id)) {
      res.status(409).json({ error: 'Already applied to this job' });
      return;
    }
    const scored = rec.topJobsForCandidate(candidate.id, store.db.jobs.length);
    const mine = scored.find((rj) => rj.job.id === job.id);
    const app = {
      id: store.nextId('a'),
      jobId: job.id,
      candidateId: candidate.id,
      matchScore: mine?.match.score ?? 0,
      status: 'applied' as const,
      appliedAt: new Date().toISOString(),
      note: req.body?.note ? String(req.body.note) : undefined,
    };
    store.db.applications.push(app);
    store.markDirty();
    res.status(201).json(app);
  });

  // ---------- recruiter: applicants for a job (+ status update) ----------
  r.get('/:id/applicants', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const recruiter = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!job || !recruiter || job.recruiterId !== recruiter.id) {
      res.status(404).json({ error: 'Job not found (or not yours)' });
      return;
    }
    const apps = store.db.applications.filter((a) => a.jobId === job.id);
    const items = apps
      .map((a) => {
        const c = store.db.candidates.find((x) => x.id === a.candidateId);
        return c ? { application: a, candidate: c } : null;
      })
      .filter((x): x is { application: typeof apps[number]; candidate: typeof store.db.candidates[number] } => x !== null)
      .sort((x, y) => y.application.matchScore - x.application.matchScore);
    res.json({ items, job: { id: job.id, title: job.title } });
  });

  // ---------- recruiter: update application status ----------
  r.put('/:id/applicants/:appId', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const recruiter = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!job || !recruiter || job.recruiterId !== recruiter.id) {
      res.status(404).json({ error: 'Job not found (or not yours)' });
      return;
    }
    const app = store.db.applications.find((a) => a.id === req.params.appId && a.jobId === job.id);
    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    const status = String(req.body?.status ?? '');
    if (!['applied', 'review', 'interview', 'offer', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'invalid status' });
      return;
    }
    app.status = status as typeof app.status;
    store.markDirty();
    res.json(app);
  });

  // ---------- recruiter: ranked candidates for one of my jobs ----------
  r.get('/:id/candidates', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const job = store.db.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const { items, metrics } = rec.rankedCandidatesForJob(job.id, {
      q: req.query.q as string,
      skill: req.query.skill as string,
      sort: (req.query.sort as SortKey) || 'matchScore',
      dir: (req.query.dir as 'asc' | 'desc') || 'desc',
      limit: 50,
    });
    res.json({
      items: items.map((rc) => ({
        candidate: rc.candidate,
        score: rc.match.score,
        breakdown: rc.match.breakdown,
        matchedSkills: rc.match.matchedSkills,
        missingRequired: rc.match.missingRequired,
      })),
      sortMetrics: metrics,
    });
  });

  // ---------- candidate: skill gap analysis + reverse resume ----------
  r.get('/:id/skill-gap', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const report = rec.skillGap(candidate.id, req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(report);
  });

  r.get('/:id/reverse-resume', requireAuth, requireRole('candidate'), async (req: Request, res: Response) => {
    const candidate = store.db.candidates.find((c) => c.userId === req.user!.id || c.id === req.user!.id);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const roadmap = rec.reverseResume(candidate.id, req.params.id);
    if (!roadmap) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    // persist (local + supabase write-through)
    await supabase?.saveRoadmap({
      id: `${candidate.id}:${req.params.id}`,
      candidateId: candidate.id,
      jobId: req.params.id,
      targetJobTitle: roadmap.targetJobTitle,
      currentMatchScore: roadmap.currentMatchScore,
      totalMonths: roadmap.totalMonths,
      payload: roadmap,
      generatedAt: new Date().toISOString(),
    });
    res.json(roadmap);
  });

  return r;
}
