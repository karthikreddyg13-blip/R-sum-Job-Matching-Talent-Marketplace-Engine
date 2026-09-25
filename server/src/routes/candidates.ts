/**
 * Candidate search (recruiter) + profile management (both roles),
 * including résumé metadata upload fields.
 */

import { Router, Request, Response } from 'express';
import { Store } from '../models/Store';
import { makeAuthGuard, requireRole } from '../middleware/auth';
import { RecommendationService } from '../services/RecommendationService';
import { AutocompleteService } from '../services/AutocompleteService';
import { SupabaseService } from '../services/SupabaseService';
import { SortKey } from '../dsa/Sorting';
import { EducationLevel } from '../services/MatchingEngine';

export function candidateRoutes(store: Store, rec: RecommendationService, auto: AutocompleteService,
  supabase: SupabaseService | null): Router {
  const r = Router();
  const requireAuth = makeAuthGuard(store, supabase);

  // ---------- recruiter: search + rank candidates ----------
  r.get('/', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const recruiter = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!recruiter) {
      res.status(404).json({ error: 'Recruiter profile not found' });
      return;
    }
    const myJobs = store.db.jobs.filter((j) => j.recruiterId === recruiter.id && j.active);
    const benchmarkJobId = String(req.query.jobId ?? myJobs[0]?.id ?? '');
    const benchmarkJob = myJobs.find((j) => j.id === benchmarkJobId);
    if (!benchmarkJob) {
      res.json({ items: [], note: 'Post a job first to get ranked candidates.' });
      return;
    }

    const { items, metrics } = rec.rankedCandidatesForJob(benchmarkJob.id, {
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
      benchmarkJob: { id: benchmarkJob.id, title: benchmarkJob.title },
    });
  });

  // ---------- candidate: my profile ----------
  r.get('/me', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const c = store.db.candidates.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!c) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    res.json(c);
  });

  // ---------- candidate: update profile (incl. résumé metadata) ----------
  r.put('/me', requireAuth, requireRole('candidate'), (req: Request, res: Response) => {
    const c = store.db.candidates.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!c) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }
    const b = req.body ?? {};
    if (b.headline !== undefined) c.headline = String(b.headline);
    if (b.location !== undefined) c.location = String(b.location);
    if (b.education !== undefined) {
      const levels = ['none', 'diploma', 'bachelors', 'masters', 'phd'];
      c.education = (levels.includes(b.education) ? b.education : c.education) as EducationLevel;
    }
    if (b.experienceYears !== undefined) c.experienceYears = Math.max(0, Number(b.experienceYears) || 0);
    if (b.skills !== undefined) {
      c.skills = Array.isArray(b.skills)
        ? b.skills.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [];
    }
    if (b.githubUrl !== undefined) c.githubUrl = String(b.githubUrl);
    if (b.linkedinUrl !== undefined) c.linkedinUrl = String(b.linkedinUrl);
    if (b.phone !== undefined) c.phone = String(b.phone);
    if (b.resumeText !== undefined) c.resumeText = String(b.resumeText);
    // résumé upload metadata (file itself lives in storage; we store its descriptors)
    if (b.resumeFileName !== undefined) {
      c.resumeFileName = String(b.resumeFileName);
      c.resumeUpdatedAt = new Date().toISOString();
    }
    if (b.resumeUrl !== undefined) c.resumeUrl = String(b.resumeUrl);
    c.updatedAt = new Date().toISOString();
    store.markDirty();
    rec.rebuildGraph();
    auto.rebuild();
    res.json(c);
  });

  // ---------- recruiter: my company profile ----------
  r.get('/company/me', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const rProf = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!rProf) {
      res.status(404).json({ error: 'Recruiter profile not found' });
      return;
    }
    res.json(rProf);
  });

  // ---------- recruiter: update company profile ----------
  r.put('/company/me', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const rProf = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!rProf) {
      res.status(404).json({ error: 'Recruiter profile not found' });
      return;
    }
    const b = req.body ?? {};
    if (b.companyName !== undefined) rProf.companyName = String(b.companyName);
    if (b.industry !== undefined) rProf.industry = String(b.industry);
    if (b.location !== undefined) rProf.location = String(b.location);
    if (b.about !== undefined) rProf.about = String(b.about);
    if (b.website !== undefined) rProf.website = String(b.website);
    store.markDirty();
    auto.rebuild();
    res.json(rProf);
  });

  // ---------- recruiter: my jobs ----------
  r.get('/company/me/jobs', requireAuth, requireRole('recruiter'), (req: Request, res: Response) => {
    const rProf = store.db.recruiters.find((x) => x.userId === req.user!.id || x.id === req.user!.id);
    if (!rProf) {
      res.status(404).json({ error: 'Recruiter profile not found' });
      return;
    }
    const jobs = store.db.jobs.filter((j) => j.recruiterId === rProf.id);
    const withCounts = jobs.map((j) => ({
      ...j,
      applicantCount: store.db.applications.filter((a) => a.jobId === j.id).length,
    }));
    res.json({ items: withCounts });
  });

  return r;
}
