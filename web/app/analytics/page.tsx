'use client';

import { useEffect, useState } from 'react';
import { analyticsOverview, analyticsDsa } from '@/lib/api';
import { Spinner, ErrorNote } from '@/components/ui';

interface DsaResult {
  n: number;
  search: Record<string, { comparisons: number; complexity: string }>;
  sort: Record<string, { comparisons: number; swaps: number; timeMs: number; complexity: string }>;
  heap: Record<string, { timeMs: number; complexity: string }>;
}

interface Overview {
  users: number; candidates: number; recruiters: number; jobs: number;
  applications: number; avgApplicationMatch: number;
  topSkills: Array<{ skill: string; count: number }>;
  demandedSkills: Array<{ skill: string; count: number }>;
  applicationsByStatus: Record<string, number>;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dsa, setDsa] = useState<DsaResult | null>(null);
  const [n, setN] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDsa = async (size: number) => {
    setLoading(true);
    try {
      setDsa((await analyticsDsa(size)) as unknown as DsaResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setOverview((await analyticsOverview()) as unknown as Overview);
        await loadDsa(2000);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxSearch = dsa ? Math.max(...Object.values(dsa.search).map((s) => s.comparisons)) : 1;
  const maxSort = dsa ? Math.max(...Object.values(dsa.sort).map((s) => s.comparisons)) : 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="muted text-sm">Platform stats + live DSA benchmarks from the engine.</p>
      </div>

      {error && <ErrorNote message={error} />}

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              ['Users', overview.users], ['Candidates', overview.candidates],
              ['Recruiters', overview.recruiters], ['Jobs', overview.jobs],
              ['Applications', overview.applications],
              ['Avg match', `${overview.avgApplicationMatch}%`],
            ].map(([label, value]) => (
              <div key={label as string} className="card p-4">
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs muted">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="card p-6">
              <h2 className="font-bold text-sm mb-3">Most common candidate skills</h2>
              <div className="space-y-2">
                {overview.topSkills.map((s) => (
                  <div key={s.skill} className="flex items-center gap-3 text-xs">
                    <span className="w-28 truncate">{s.skill}</span>
                    <div className="progress-track flex-1"><div className="progress-fill" style={{ width: `${(s.count / overview.topSkills[0].count) * 100}%` }} /></div>
                    <span className="muted w-8 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-6">
              <h2 className="font-bold text-sm mb-3">Most demanded job skills</h2>
              <div className="space-y-2">
                {overview.demandedSkills.map((s) => (
                  <div key={s.skill} className="flex items-center gap-3 text-xs">
                    <span className="w-28 truncate">{s.skill}</span>
                    <div className="progress-track flex-1"><div className="progress-fill" style={{ width: `${(s.count / overview.demandedSkills[0].count) * 100}%` }} /></div>
                    <span className="muted w-8 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="font-bold">DSA Benchmark Playground</h2>
          <div className="flex gap-2 items-center">
            {[1000, 2000, 5000, 10000].map((size) => (
              <button key={size} className={`badge ${n === size ? 'font-bold' : ''}`}
                style={n === size ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                onClick={() => { setN(size); loadDsa(size); }}>
                n={size.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {loading && <Spinner label="Running benchmark…" />}
        {dsa && !loading && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold muted mb-3 uppercase">Search — comparisons (target hit)</h3>
              {Object.entries(dsa.search).map(([name, r]) => (
                <div key={name} className="flex items-center gap-3 text-xs mb-2">
                  <span className="w-16">{name}</span>
                  <div className="progress-track flex-1">
                    <div className="progress-fill" style={{ width: `${(r.comparisons / maxSearch) * 100}%`, background: 'linear-gradient(90deg,#34d399,#10b981)' }} />
                  </div>
                  <span className="muted w-24 text-right">{r.comparisons.toLocaleString()} · {r.complexity}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold muted mb-3 uppercase">Sort — comparisons</h3>
              {Object.entries(dsa.sort).map(([name, r]) => (
                <div key={name} className="flex items-center gap-3 text-xs mb-2">
                  <span className="w-16">{name}</span>
                  <div className="progress-track flex-1">
                    <div className="progress-fill" style={{ width: `${(r.comparisons / maxSort) * 100}%`, background: 'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
                  </div>
                  <span className="muted w-24 text-right">{r.comparisons.toLocaleString()} · {r.complexity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
