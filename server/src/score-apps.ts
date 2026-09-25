/**
 * Recomputes match scores for applications using the MatchingEngine.
 * Kept separate so seed.ts stays readable.
 */

import { Store } from './models/Store';
import { MatchingEngine } from './services/MatchingEngine';

export async function scoreExistingApplications(store: Store): Promise<void> {
  const engine = new MatchingEngine();
  for (const a of store.db.applications) {
    const cand = store.db.candidates.find((c) => c.id === a.candidateId);
    const job = store.db.jobs.find((j) => j.id === a.jobId);
    if (!cand || !job) continue;
    const result = engine.scoreCandidateForJob(
      {
        id: cand.id,
        name: cand.name,
        skills: cand.skills,
        education: cand.education,
        experienceYears: cand.experienceYears,
      },
      {
        id: job.id,
        title: job.title,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.requiredSkills.filter((s) => s.weight <= 2),
        minEducation: job.minEducation,
        minExperienceYears: job.minExperienceYears,
      }
    );
    a.matchScore = result.score;
  }
}
