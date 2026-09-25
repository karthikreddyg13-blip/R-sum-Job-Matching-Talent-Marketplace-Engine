'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getUser, candidateSearch, myJobs, CandidateRecommendation, Job,
} from '@/lib/api';
import { Spinner, ErrorNote, ScorePill, ProgressBar } from '@/components/ui';
import { SuggestInput } from '@/components/SuggestInput';

export default function CandidateSearchPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState('');
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [sort, setSort] = useState('matchScore');
  const [items, setItems] = useState<CandidateRecommendation[]>([]);
  const [metrics, setMetrics] = useState<{ comparisons: number; swaps: number; timeMs: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'recruiter') { router.push('/login'); return; }
    (async () => {
      try {
        const res = await myJobs();
        setJobs(res.items);
        if (res.items[0]) setJobId(res.items[0].id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const search = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await candidateSearch({ jobId, q, skill, sort });
      setItems(res.items);
      setMetrics(res.sortMetrics);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [jobId, q, skill, sort]);

  useEffect(() => {
    if (jobId) search();
  }, [jobId, sort, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidate Search</h1>
        <p className="muted text-sm">
          Every candidate scored against your selected job — ranked by DSA layer (quickSort).
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <input className="input" placeholder="Name / headline / city" value={q} onChange={(e) => setQ(e.target.value)} />
          <SuggestInput kind="skill" placeholder="Filter by skill (trie)" value={skill} onChange={setSkill} />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="matchScore">Sort: Match Score</option>
            <option value="experience">Sort: Experience</option>
            <option value="skillCount">Sort: Skill Count</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={search}>Search</button>
      </div>

      {metrics && (
        <div className="text-xs muted">
          quickSort metrics: {metrics.comparisons.toLocaleString()} comparisons · {metrics.timeMs}ms
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}

      {!loading && (
        <div className="grid lg:grid-cols-2 gap-4">
          {items.map((rc, i) => (
            <div key={rc.candidate.id} className="card p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-sm">#{i + 1} {rc.candidate.name}</div>
                  <div className="text-xs muted">{rc.candidate.headline || '—'}</div>
                  <div className="text-xs muted">{rc.candidate.location} · {rc.candidate.experienceYears}y exp · {rc.candidate.education}</div>
                </div>
                <ScorePill score={rc.score} />
              </div>
              <ProgressBar value={rc.score} />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {rc.candidate.skills.map((s) => {
                  const matched = rc.matchedSkills.includes(s);
                  return (
                    <span key={s} className="badge" style={matched ? { borderColor: 'var(--success)', color: 'var(--success)' } : {}}>
                      {matched ? '✓' : '·'} {s}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="card p-8 text-center muted text-sm lg:col-span-2">
              No candidates found. Try clearing filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
