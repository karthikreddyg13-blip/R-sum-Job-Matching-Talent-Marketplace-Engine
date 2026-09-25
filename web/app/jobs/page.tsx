'use client';

import { useEffect, useState } from 'react';
import { rankedJobs, listJobs, Job, JobRecommendation } from '@/lib/api';
import { Spinner, ErrorNote, ScorePill } from '@/components/ui';
import { SuggestInput } from '@/components/SuggestInput';
import { JobCard } from '@/components/JobCard';
import { getUser } from '@/lib/api';

export default function JobSearchPage() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('matchScore');
  const [items, setItems] = useState<JobRecommendation[]>([]);
  const [metrics, setMetrics] = useState<{ comparisons: number; swaps: number; timeMs: number } | null>(null);
  const [fallbackJobs, setFallbackJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getUser()) return;
    (async () => {
      setLoading(true);
      try {
        const res = await rankedJobs(q, sort);
        setItems(res.items);
        setMetrics(res.sortMetrics);
        setFallbackJobs([]);
      } catch {
        // not logged in as candidate (or API down) — fall back to public list
        try {
          const pub = await listJobs(q);
          setFallbackJobs(pub.items);
          setItems([]);
        } catch (e) {
          setError((e as Error).message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [q, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job Search</h1>
        <p className="muted text-sm">Ranked by the DSA engine — quickSort on your chosen key.</p>
      </div>

      <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex-1">
          <SuggestInput kind="job" placeholder="Search title, skill or city…" value={q} onChange={setQ} />
        </div>
        <select className="input md:w-52" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="matchScore">Sort: Match Score</option>
          <option value="skillCount">Sort: Skill Count</option>
          <option value="experience">Sort: Experience Fit</option>
          <option value="recency">Sort: Recency</option>
        </select>
      </div>

      {metrics && (
        <div className="text-xs muted">
          quickSort metrics: {metrics.comparisons.toLocaleString()} comparisons · {metrics.swaps.toLocaleString()} swaps · {metrics.timeMs}ms
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}

      {!loading && items.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {items.map((it) => (
            <JobCard key={it.job.id} item={it} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && fallbackJobs.length > 0 && (
        <div>
          <div className="text-xs muted mb-3">Showing public job list — log in as a candidate to see personalized match scores.</div>
          <div className="grid lg:grid-cols-2 gap-4">
            {fallbackJobs.map((j) => (
              <div key={j.id} className="card p-5">
                <div className="flex justify-between items-start">
                  <div className="font-semibold">{j.title}</div>
                  <ScorePill score={0} />
                </div>
                <div className="text-xs muted mt-1">{j.location} · {j.workMode} · {j.minExperienceYears}+ yrs</div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {j.requiredSkills.map((s) => <span key={s.name} className="badge">{s.name}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && items.length === 0 && fallbackJobs.length === 0 && !error && (
        <div className="card p-8 text-center muted text-sm">No jobs match your search.</div>
      )}
    </div>
  );
}
