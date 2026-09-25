'use client';

import Link from 'next/link';
import { useState } from 'react';
import { JobRecommendation, applyToJob, skillGap, saveJob, unsaveJob, SkillGapReport } from '@/lib/api';
import { ProgressBar, ScorePill } from './ui';

export function JobCard({
  item,
  showApply = true,
}: {
  item: JobRecommendation;
  showApply?: boolean;
}) {
  const [applied, setApplied] = useState(false);
  const [gap, setGap] = useState<SkillGapReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const job = item.job;

  const handleSave = async () => {
    setBusy(true);
    try {
      if (saved) {
        await unsaveJob(job.id);
        setSaved(false);
      } else {
        await saveJob(job.id);
        setSaved(true);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    setBusy(true);
    try {
      await applyToJob(job.id);
      setApplied(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGap = async () => {
    setBusy(true);
    try {
      const report = await skillGap(job.id);
      setGap(report);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <Link href={`/jobs/${job.id}`} className="font-semibold text-base hover:underline">
            {job.title}
          </Link>
          <div className="text-xs muted mt-1">
            {job.location} · {job.workMode} · {job.minExperienceYears}+ yrs ·{' '}
            {job.minEducation}
          </div>
        </div>
        <ScorePill score={item.score} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <ProgressBar label="Required skills (50%)" value={(item.breakdown?.requiredSkillMatch ?? 0) * 100} />
        <ProgressBar label="Preferred (20%)" value={(item.breakdown?.preferredSkillMatch ?? 0) * 100} />
        <ProgressBar label="Education (15%)" value={(item.breakdown?.educationMatch ?? 0) * 100} />
        <ProgressBar label="Experience (15%)" value={(item.breakdown?.experienceMatch ?? 0) * 100} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {job.requiredSkills.map((s) => {
          const matched = item.matchedSkills.includes(s.name);
          const missing = item.missingRequired.includes(s.name);
          return (
            <span
              key={s.name}
              className="badge"
              style={{
                borderColor: matched ? 'var(--success)' : missing ? 'var(--danger)' : 'var(--border)',
                color: matched ? 'var(--success)' : missing ? 'var(--danger)' : 'var(--muted)',
              }}
            >
              {matched ? '✓' : missing ? '✕' : '○'} {s.name}
              {s.weight >= 3 ? '' : ' (pref)'}
            </span>
          );
        })}
      </div>

      {gap && (
        <div className="card p-3 mb-4 text-xs" style={{ background: 'var(--bg-soft)' }}>
          <div className="font-semibold mb-1">
            Skill gap: {gap.gapCount === 0 ? 'none — you are a perfect fit!' : `${gap.gapCount} missing (${gap.gapSeverity})`}
          </div>
          {gap.missingRequired.length > 0 && (
            <div style={{ color: 'var(--danger)' }}>Missing required: {gap.missingRequired.join(', ')}</div>
          )}
          {gap.missingPreferred.length > 0 && (
            <div style={{ color: 'var(--warn)' }}>Missing preferred: {gap.missingPreferred.join(', ')}</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {showApply && (
          <button className="btn btn-primary" onClick={handleApply} disabled={busy || applied}>
            {applied ? '✓ Applied' : 'Apply'}
          </button>
        )}
        <button className="btn btn-ghost" onClick={handleSave} disabled={busy}>
          {saved ? '★ Saved' : '☆ Save'}
        </button>
        <button className="btn btn-ghost" onClick={handleGap} disabled={busy}>
          Skill gap
        </button>
        <Link className="btn btn-ghost" href={`/roadmap?jobId=${job.id}`}>
          Reverse resume →
        </Link>
      </div>
    </div>
  );
}
