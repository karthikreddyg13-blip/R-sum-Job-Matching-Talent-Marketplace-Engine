/**
 * ============================================================================
 *  MATCHING ENGINE — WEIGHTED RANKING FORMULA
 * ============================================================================
 *  Match Score (0-100) =
 *      Required Skills Match  × 50%
 *    + Preferred Skills Match × 20%
 *    + Education Match        × 15%
 *    + Experience Match       × 15%
 *
 *  The score is computed pairwise between one candidate and one job. Batch
 *  scoring fans out over all jobs/candidates and results are pushed into a
 *  MaxHeap for top-k retrieval and quickSort for full ranked lists.
 *
 *  Skill lookups use the from-scratch HashMap (O(1) average) so a batch of
 *  C×J pair scores runs in O(C·J·S) with S = skills per job.
 * ============================================================================
 */

import { HashMap } from '../dsa/HashMap';

export interface SkillRequirement {
  name: string;
  /** 3..5 required (weighted in the 50% bucket), 1..2 preferred (20% bucket) */
  weight: 1 | 2 | 3 | 4 | 5;
}

export interface CandidateProfileLite {
  id: string;
  name: string;
  skills: string[];                 // canonical skill names
  education: EducationLevel;
  experienceYears: number;
  [k: string]: unknown;
}

export interface JobLite {
  id: string;
  title: string;
  requiredSkills: SkillRequirement[];  // weight >= 3
  preferredSkills: SkillRequirement[]; // weight <= 2
  minEducation: EducationLevel;
  minExperienceYears: number;
  [k: string]: unknown;
}

export type EducationLevel = 'none' | 'diploma' | 'bachelors' | 'masters' | 'phd';

const EDUCATION_RANK: Record<EducationLevel, number> = {
  none: 0,
  diploma: 1,
  bachelors: 2,
  masters: 3,
  phd: 4,
};

export interface MatchBreakdown {
  requiredSkillMatch: number;  // 0..1
  preferredSkillMatch: number; // 0..1
  educationMatch: number;      // 0..1
  experienceMatch: number;     // 0..1
}

export interface MatchResult {
  candidateId: string;
  jobId: string;
  score: number; // 0..100
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingRequired: string[];
  missingPreferred: string[];
}

/** Canonicalize a skill string for hashmap keys. */
export function canonSkill(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9+#. ]/g, '');
}

/** Split a job's skill requirements into required vs preferred buckets. */
export function splitSkills(job: JobLite): { required: SkillRequirement[]; preferred: SkillRequirement[] } {
  const required: SkillRequirement[] = [];
  const preferred: SkillRequirement[] = [];
  for (const s of job.requiredSkills ?? []) {
    if (s.weight >= 3) required.push(s);
    else preferred.push(s);
  }
  return { required, preferred };
}

export class MatchingEngine {
  /** HashMap<canonical skill, true> — demonstrates O(1) skill membership. */
  private skillIndex: HashMap<string, boolean> = new HashMap();

  /** Load candidate skills into the hashmap index. */
  private indexCandidateSkills(candidate: CandidateProfileLite): void {
    this.skillIndex.clear();
    for (const s of candidate.skills) this.skillIndex.put(canonSkill(s), true);
  }

  private hasSkill(name: string): boolean {
    return this.skillIndex.has(canonSkill(name));
  }

  /**
   * Core pairwise scorer. Pure function of (candidate, job).
   * Every sub-score is clamped to 0..1; total is scaled to 0..100.
   */
  scoreCandidateForJob(candidate: CandidateProfileLite, job: JobLite): MatchResult {
    this.indexCandidateSkills(candidate);
    const { required, preferred } = splitSkills(job);

    // ---- Required skills (50%) -------------------------------------------
    let reqHits = 0;
    const matched: string[] = [];
    const missingRequired: string[] = [];
    for (const s of required) {
      if (this.hasSkill(s.name)) {
        reqHits += s.weight; // weight-aware: must-have skills count more
        matched.push(s.name);
      } else {
        missingRequired.push(s.name);
      }
    }
    const maxReqWeight = required.reduce((a, s) => a + s.weight, 0) || 1;
    const requiredSkillMatch = required.length ? reqHits / maxReqWeight : 1;

    // ---- Preferred skills (20%) ------------------------------------------
    let prefHits = 0;
    const missingPreferred: string[] = [];
    for (const s of preferred) {
      if (this.hasSkill(s.name)) {
        prefHits++;
        matched.push(s.name);
      } else {
        missingPreferred.push(s.name);
      }
    }
    const preferredSkillMatch = preferred.length ? prefHits / preferred.length : 1;

    // ---- Education (15%) ---------------------------------------------------
    const cRank = EDUCATION_RANK[candidate.education] ?? 0;
    const jRank = EDUCATION_RANK[job.minEducation] ?? 0;
    let educationMatch: number;
    if (cRank >= jRank) {
      // one level above requirement earns full marks; beyond that no extra
      educationMatch = cRank === jRank ? 1 : cRank === jRank + 1 ? 1 : 1;
    } else {
      const gap = jRank - cRank;
      educationMatch = Math.max(0, 1 - gap * 0.5); // one level short = 0.5
    }

    // ---- Experience (15%) ---------------------------------------------------
    const reqExp = job.minExperienceYears ?? 0;
    const cExp = candidate.experienceYears ?? 0;
    const experienceMatch = cExp >= reqExp ? 1 : reqExp === 0 ? 1 : Math.max(0, cExp / reqExp);

    const breakdown: MatchBreakdown = {
      requiredSkillMatch,
      preferredSkillMatch,
      educationMatch,
      experienceMatch,
    };

    const score =
      requiredSkillMatch * 0.5 +
      preferredSkillMatch * 0.2 +
      educationMatch * 0.15 +
      experienceMatch * 0.15;

    return {
      candidateId: candidate.id,
      jobId: job.id,
      score: Math.round(score * 1000) / 10, // one decimal, 0..100
      breakdown,
      matchedSkills: [...new Set(matched)],
      missingRequired,
      missingPreferred,
    };
  }

  /** Batch: score one candidate against all jobs. */
  rankJobsForCandidate(candidate: CandidateProfileLite, jobs: JobLite[]): MatchResult[] {
    return jobs.map((j) => this.scoreCandidateForJob(candidate, j));
  }

  /** Batch: score all candidates against one job (recruiter view). */
  rankCandidatesForJob(job: JobLite, candidates: CandidateProfileLite[]): MatchResult[] {
    return candidates.map((c) => this.scoreCandidateForJob(c, job));
  }
}
