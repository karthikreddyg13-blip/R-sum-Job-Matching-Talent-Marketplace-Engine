/**
 * ============================================================================
 *  SKILL GAP ANALYZER
 * ============================================================================
 *  Given a candidate and a target job, produce:
 *    - current match %
 *    - matched skills (green)
 *    - missing required skills (red) and missing preferred (amber)
 *    - a per-skill action list for the Reverse Resume module
 * ============================================================================
 */

import {
  MatchingEngine,
  CandidateProfileLite,
  JobLite,
  canonSkill,
} from './MatchingEngine';

export interface SkillGapItem {
  skill: string;
  category: 'matched' | 'missing-required' | 'missing-preferred';
}

export interface SkillGapReport {
  jobId: string;
  jobTitle: string;
  candidateId: string;
  matchScore: number;                 // 0..100
  matchedSkills: string[];
  missingRequired: string[];
  missingPreferred: string[];
  gapCount: number;
  gapSeverity: 'none' | 'small' | 'moderate' | 'large';
  items: SkillGapItem[];
}

export class SkillGapAnalyzer {
  private engine = new MatchingEngine();

  analyze(candidate: CandidateProfileLite, job: JobLite): SkillGapReport {
    const result = this.engine.scoreCandidateForJob(candidate, job);

    const items: SkillGapItem[] = [
      ...result.matchedSkills.map((s) => ({ skill: s, category: 'matched' as const })),
      ...result.missingRequired.map((s) => ({ skill: s, category: 'missing-required' as const })),
      ...result.missingPreferred.map((s) => ({ skill: s, category: 'missing-preferred' as const })),
    ];

    const gapCount = result.missingRequired.length;
    const severity: SkillGapReport['gapSeverity'] =
      gapCount === 0 ? 'none' : gapCount <= 2 ? 'small' : gapCount <= 4 ? 'moderate' : 'large';

    return {
      jobId: job.id,
      jobTitle: job.title,
      candidateId: candidate.id,
      matchScore: result.score,
      matchedSkills: result.matchedSkills,
      missingRequired: result.missingRequired,
      missingPreferred: result.missingPreferred,
      gapCount,
      gapSeverity: severity,
      items,
    };
  }
}
