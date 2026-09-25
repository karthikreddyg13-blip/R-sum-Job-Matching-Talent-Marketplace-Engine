/**
 * RECOMMENDATION SERVICE
 * ----------------------------------------------------------------------------
 * Orchestrates the DSA layer into product features:
 *
 *   topJobsForCandidate   : match score -> MaxHeap -> top-k jobs
 *   topCandidatesForJob   : match score -> MaxHeap -> top-k candidates
 *   rankedJobs            : quickSort on matchScore / experience / skillCount
 *   similarJobs           : EntityGraph BFS
 *   relatedSkills         : EntityGraph BFS co-occurrence
 *   candidateReach        : EntityGraph multi-hop job reach
 *
 * Every scored result also carries its breakdown so the UI can render the
 * 50/20/15/15 bars.
 */

import { Store } from '../models/Store';
import { MatchingEngine, MatchResult, CandidateProfileLite, JobLite, canonSkill } from './MatchingEngine';
import { MaxHeap, HeapItem } from '../dsa/MaxHeap';
import { EntityGraph, GraphNode, RelationType, NodeType } from '../dsa/EntityGraph';
import { SkillGapAnalyzer, SkillGapReport } from './SkillGapAnalyzer';
import { ReverseResumeGenerator, ReverseResumeRoadmap } from './ReverseResumeGenerator';
import { sortByKey, SortKey } from '../dsa/Sorting';
import { Job, Candidate } from '../models/types';

export interface RankedJob {
  job: JobLite & { [k: string]: unknown };
  match: MatchResult;
}

export interface RankedCandidate {
  candidate: CandidateProfileLite & { [k: string]: unknown };
  match: MatchResult;
}

export class RecommendationService {
  private engine = new MatchingEngine();
  private gapAnalyzer = new SkillGapAnalyzer();
  private roadmapGen = new ReverseResumeGenerator();
  private graph = new EntityGraph();

  constructor(private store: Store) {}

  // ------------------------------------------------------------- graph build

  /** Rebuild the entity graph (called after seed / any data mutation). */
  rebuildGraph(): void {
    this.graph = new EntityGraph();
    const db = this.store.db;

    // skill nodes
    const skillSet = new Set<string>();
    for (const c of db.candidates) for (const s of c.skills) skillSet.add(s.toLowerCase().trim());
    for (const j of db.jobs) for (const s of j.requiredSkills) skillSet.add(s.name.toLowerCase().trim());
    for (const s of skillSet) {
      this.graph.addNode({ key: `skill:${s}`, type: 'skill', label: s });
    }

    // candidate -> skill edges
    for (const c of db.candidates) {
      this.graph.addNode({ key: `candidate:${c.id}`, type: 'candidate', label: c.name });
      for (const s of c.skills) {
        this.graph.addEdge({
          from: `candidate:${c.id}`,
          to: `skill:${s.toLowerCase().trim()}`,
          relation: 'has_skill',
          weight: 3,
        });
      }
    }

    // job -> skill edges
    for (const j of db.jobs) {
      this.graph.addNode({ key: `job:${j.id}`, type: 'job', label: j.title });
      for (const s of j.requiredSkills) {
        const w = s.weight >= 3 ? s.weight : s.weight; // required vs preferred
        this.graph.addEdge({
          from: `job:${j.id}`,
          to: `skill:${s.name.toLowerCase().trim()}`,
          relation: 'requires_skill',
          weight: w,
        });
      }
      // job -> recruiter edge
      const recruiter = db.recruiters.find((r) => r.id === j.recruiterId);
      if (recruiter) {
        this.graph.addNode({ key: `recruiter:${recruiter.id}`, type: 'recruiter', label: recruiter.companyName });
        this.graph.addEdge({
          from: `job:${j.id}`,
          to: `recruiter:${recruiter.id}`,
          relation: 'posted_by',
          weight: 1,
        });
      }
    }
  }

  // -------------------------------------------------------- score + heap top-k

  private toJobLite(j: Job): JobLite {
    return {
      ...j,
      preferredSkills: j.requiredSkills.filter((s) => s.weight <= 2),
    };
  }

  private toCandidateLite(c: Candidate): CandidateProfileLite {
    return {
      ...c,
    };
  }

  /** Top-k jobs for a candidate via MaxHeap. O(J·S + J log k). */
  topJobsForCandidate(candidateId: string, k = 10): RankedJob[] {
    const db = this.store.db;
    const candidate = db.candidates.find((c) => c.id === candidateId);
    if (!candidate) return [];
    const cLite = this.toCandidateLite(candidate);

    const scored: RankedJob[] = db.jobs
      .filter((j) => j.active)
      .map((j) => ({ job: this.toJobLite(j), match: this.engine.scoreCandidateForJob(cLite, this.toJobLite(j)) }));

    const items: HeapItem[] = scored.map((r) => ({ id: r.job.id, score: r.match.score, payload: r }));
    const top = MaxHeap.topK(items, k);
    return top.map((h) => h.payload as RankedJob);
  }

  /** Top-k candidates for one job via MaxHeap. O(C·S + C log k). */
  topCandidatesForJob(jobId: string, k = 10): RankedCandidate[] {
    const db = this.store.db;
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) return [];
    const jLite = this.toJobLite(job);

    const scored: RankedCandidate[] = db.candidates.map((c) => ({
      candidate: this.toCandidateLite(c),
      match: this.engine.scoreCandidateForJob(this.toCandidateLite(c), jLite),
    }));

    const items: HeapItem[] = scored.map((r) => ({ id: r.candidate.id, score: r.match.score, payload: r }));
    const top = MaxHeap.topK(items, k);
    return top.map((h) => h.payload as RankedCandidate);
  }

  /** Full ranked list of jobs with sorting options for the search page. */
  rankedJobsForCandidate(
    candidateId: string,
    opts: { q?: string; sort?: SortKey; dir?: 'asc' | 'desc'; limit?: number } = {}
  ): { items: RankedJob[]; metrics: { comparisons: number; swaps: number; timeMs: number } } {
    const db = this.store.db;
    const candidate = db.candidates.find((c) => c.id === candidateId);
    if (!candidate) return { items: [], metrics: { comparisons: 0, swaps: 0, timeMs: 0 } };
    const cLite = this.toCandidateLite(candidate);

    let results: RankedJob[] = db.jobs
      .filter((j) => j.active)
      .map((j) => ({ job: this.toJobLite(j), match: this.engine.scoreCandidateForJob(cLite, this.toJobLite(j)) }));

    if (opts.q) {
      const needle = opts.q.toLowerCase().trim();
      results = results.filter(
        (r) =>
          r.job.title.toLowerCase().includes(needle) ||
          String(r.job.location ?? '').toLowerCase().includes(needle) ||
          r.job.requiredSkills.some((s) => s.name.toLowerCase().includes(needle))
      );
    }

    // decorate with sort-friendly fields
    const decorated = results.map((r) => ({
      ...r,
      matchScore: r.match.score,
      skillCount: r.job.requiredSkills.length,
      experience: r.match.breakdown.experienceMatch,
    }));

    const sortKey: SortKey = opts.sort ?? 'matchScore';
    const { sorted, metrics } = sortByKey(decorated as unknown as Array<Record<string, unknown>>, sortKey, opts.dir ?? 'desc');
    const items = sorted.slice(0, opts.limit ?? 50) as unknown as RankedJob[];
    return { items, metrics };
  }

  /** Full ranked list of candidates for a job (recruiter search page). */
  rankedCandidatesForJob(
    jobId: string,
    opts: { q?: string; skill?: string; sort?: SortKey; dir?: 'asc' | 'desc'; limit?: number } = {}
  ): { items: RankedCandidate[]; metrics: { comparisons: number; swaps: number; timeMs: number } } {
    const db = this.store.db;
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job) return { items: [], metrics: { comparisons: 0, swaps: 0, timeMs: 0 } };
    const jLite = this.toJobLite(job);

    let results: RankedCandidate[] = db.candidates.map((c) => ({
      candidate: this.toCandidateLite(c),
      match: this.engine.scoreCandidateForJob(this.toCandidateLite(c), jLite),
    }));

    if (opts.q) {
      const needle = opts.q.toLowerCase().trim();
      results = results.filter(
        (r) =>
          r.candidate.name.toLowerCase().includes(needle) ||
          String(r.candidate.headline ?? '').toLowerCase().includes(needle) ||
          String(r.candidate.location ?? '').toLowerCase().includes(needle)
      );
    }
    if (opts.skill) {
      const needle = canonSkill(opts.skill);
      results = results.filter((r) =>
        r.candidate.skills.some((s) => canonSkill(s).includes(needle))
      );
    }

    const decorated = results.map((r) => ({
      ...r,
      matchScore: r.match.score,
      skillCount: r.candidate.skills.length,
      experience: r.candidate.experienceYears,
    }));

    const sortKey: SortKey = opts.sort ?? 'matchScore';
    const { sorted, metrics } = sortByKey(decorated as unknown as Array<Record<string, unknown>>, sortKey, opts.dir ?? 'desc');
    const items = sorted.slice(0, opts.limit ?? 50) as unknown as RankedCandidate[];
    return { items, metrics };
  }

  // ------------------------------------------------------------- skill gap + roadmap

  skillGap(candidateId: string, jobId: string): SkillGapReport | null {
    const db = this.store.db;
    const c = db.candidates.find((x) => x.id === candidateId);
    const j = db.jobs.find((x) => x.id === jobId);
    if (!c || !j) return null;
    return this.gapAnalyzer.analyze(this.toCandidateLite(c), this.toJobLite(j));
  }

  reverseResume(candidateId: string, jobId: string): ReverseResumeRoadmap | null {
    const gap = this.skillGap(candidateId, jobId);
    if (!gap) return null;
    return this.roadmapGen.generate(gap);
  }

  // ------------------------------------------------------------------ graph features

  similarJobs(jobId: string, limit = 6): Array<{ jobId: string; sharedSkills: number; title: string }> {
    this.rebuildGraph();
    const levels = this.graph.bfs(`job:${jobId}`, 2);
    const scores: Array<{ key: string; sharedSkills: number }> = [];
    const seen = new Set<string>([jobId]);

    for (const keys of levels.values()) {
      for (const key of keys) {
        if (!key.startsWith('job:') || seen.has(key)) continue;
        seen.add(key);
        scores.push({ key, sharedSkills: this.sharedSkillCount(jobId, key.slice(4)) });
      }
    }
    scores.sort((a, b) => b.sharedSkills - a.sharedSkills);
    return scores.slice(0, limit).map((s) => {
      const j = this.store.db.jobs.find((x) => x.id === s.key.slice(4));
      return { jobId: s.key.slice(4), sharedSkills: s.sharedSkills, title: j?.title ?? 'Unknown' };
    });
  }

  relatedSkills(skill: string, limit = 6): Array<{ skill: string; strength: number }> {
    this.rebuildGraph();
    const key = `skill:${skill.toLowerCase().trim()}`;
    if (!this.graph.hasNode(key)) return [];
    const levels = this.graph.bfs(key, 2);
    const strength: Map<string, number> = new Map();

    for (const keys of levels.values()) {
      for (const nodeKey of keys) {
        if (!nodeKey.startsWith('job:')) continue;
        for (const edge of this.graph.neighbors(nodeKey)) {
          if (edge.relation !== 'requires_skill' || edge.to === key) continue;
          if (!edge.to.startsWith('skill:')) continue;
          strength.set(edge.to, (strength.get(edge.to) ?? 0) + edge.weight);
        }
      }
    }
    return [...strength.entries()]
      .map(([k, s]) => ({ skill: k.slice(6), strength: s }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);
  }

  candidateReach(candidateId: string): number {
    this.rebuildGraph();
    return this.graph.candidateReach(`candidate:${candidateId}`, 2);
  }

  graphSnapshot(): ReturnType<EntityGraph['snapshot']> {
    this.rebuildGraph();
    return this.graph.snapshot(120);
  }

  private sharedSkillCount(jobA: string, jobB: string): number {
    const a = this.store.db.jobs.find((x) => x.id === jobA);
    const b = this.store.db.jobs.find((x) => x.id === jobB);
    if (!a || !b) return 0;
    const setA = new Set(a.requiredSkills.map((s) => s.name.toLowerCase().trim()));
    let shared = 0;
    for (const s of b.requiredSkills) if (setA.has(s.name.toLowerCase().trim())) shared++;
    return shared;
  }
}
