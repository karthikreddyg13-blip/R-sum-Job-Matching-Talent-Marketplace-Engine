'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getUser, jobRecommendations, skillGap, reverseResume,
  JobRecommendation, SkillGapReport, Roadmap,
} from '@/lib/api';
import { Spinner, ErrorNote, ProgressBar } from '@/components/ui';
import { SuggestInput } from '@/components/SuggestInput';

function RoadmapInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [jobId, setJobId] = useState(params.get('jobId') ?? '');
  const [gap, setGap] = useState<SkillGapReport | null>(null);
  const [plan, setPlan] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getUser()) { router.push('/login'); return; }
    (async () => {
      try {
        const recs = await jobRecommendations(25);
        setJobs(recs.items);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setGap(null);
    setPlan(null);
    try {
      const g = await skillGap(id);
      setGap(g);
      const p = await reverseResume(id);
      setPlan(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (jobId) load(jobId);
  }, [jobId, load]);

  if (loading && !plan && jobs.length === 0) return <Spinner label="Building roadmap…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reverse Resume Roadmap</h1>
        <p className="muted text-sm">Pick a dream job — we reverse-engineer the skills, courses and projects to get you there.</p>
      </div>

      <div className="card p-4">
        <label className="text-xs muted block mb-2">Target role (autocomplete over live jobs)</label>
        <SuggestInput kind="job" placeholder="e.g. AI Engineer, DevOps Engineer…" onPick={(s) => {
          const match = jobs.find((j) => j.job.title.toLowerCase() === s.toLowerCase());
          if (match) setJobId(match.job.id);
        }} />
        {jobs.length > 0 && !plan && (
          <div className="flex flex-wrap gap-2 mt-3">
            {jobs.slice(0, 6).map((j) => (
              <button key={j.job.id} className={`badge ${jobId === j.job.id ? 'font-bold' : ''}`}
                style={jobId === j.job.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                onClick={() => setJobId(j.job.id)}>
                {j.job.title} · {j.score.toFixed(0)}%
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <Spinner label="Analyzing skill gap…" />}
      {error && <ErrorNote message={error} />}

      {gap && (
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-bold">Skill Gap — {gap.jobTitle}</h2>
            <span className="badge">{gap.gapSeverity === 'none' ? 'Perfect fit 🎉' : `${gap.gapSeverity} gap`}</span>
          </div>
          <ProgressBar label="Current match" value={gap.matchScore} />
          <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
            <div>
              <div className="text-xs muted mb-1.5">✓ Matched</div>
              <div className="flex flex-wrap gap-1.5">
                {gap.matchedSkills.map((s) => (
                  <span key={s} className="badge" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>{s}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs muted mb-1.5">✕ Missing</div>
              <div className="flex flex-wrap gap-1.5">
                {gap.missingRequired.map((s) => (
                  <span key={s} className="badge" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{s}</span>
                ))}
                {gap.missingPreferred.map((s) => (
                  <span key={s} className="badge" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>{s} (pref)</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {plan && (
        <>
          <section className="card p-6">
            <div className="flex flex-wrap justify-between gap-4 mb-6">
              <div>
                <div className="text-xs muted">Roadmap to</div>
                <div className="text-xl font-bold">{plan.targetJobTitle}</div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{plan.totalMonths}</div>
                  <div className="text-xs muted">months</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{plan.currentMatchScore.toFixed(0)}%</div>
                  <div className="text-xs muted">now</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{plan.targetMatchScore.toFixed(0)}%</div>
                  <div className="text-xs muted">projected</div>
                </div>
              </div>
            </div>

            <h3 className="font-semibold text-sm mb-3">Skills to learn (topologically ordered)</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plan.skills.map((s) => (
                <div key={s.skill} className="card p-3" style={{ background: 'var(--bg-soft)' }}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{s.skill}</span>
                    <span className="badge">{s.difficulty}</span>
                  </div>
                  <div className="text-xs muted mt-1">{s.category} · ~{s.weeks} weeks</div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="card p-6">
              <h3 className="font-semibold text-sm mb-3">📚 Recommended Courses</h3>
              <div className="space-y-2">
                {plan.courses.map((c) => (
                  <div key={c.name} className="flex justify-between items-center text-sm py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <div>{c.name}</div>
                      <div className="text-xs muted">{c.platform} · {c.duration}</div>
                    </div>
                    <span className="badge" style={c.free ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}}>
                      {c.free ? 'Free' : 'Paid'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-6">
              <h3 className="font-semibold text-sm mb-3">🚀 Portfolio Projects</h3>
              <div className="space-y-3">
                {plan.projects.map((p) => (
                  <div key={p.name} className="card p-3" style={{ background: 'var(--bg-soft)' }}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="badge">{p.difficulty}</span>
                    </div>
                    <p className="text-xs muted mt-1">{p.description}</p>
                    <div className="text-xs muted mt-1">~{p.estimatedDays} days</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card p-6">
            <h3 className="font-semibold text-sm mb-4">📅 Month-by-month Timeline</h3>
            <div className="space-y-0">
              {plan.milestones.map((m, i) => (
                <div key={m.month} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)' }} />
                    {i < plan.milestones.length - 1 && <div className="w-px flex-1" style={{ background: 'var(--border)' }} />}
                  </div>
                  <div className="pb-6 flex-1">
                    <div className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{m.month}</div>
                    <div className="text-sm font-medium mt-0.5">{m.title}</div>
                    <p className="text-xs muted mt-1">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <RoadmapInner />
    </Suspense>
  );
}
