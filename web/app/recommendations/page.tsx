'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jobRecommendations, JobRecommendation, getUser } from '@/lib/api';
import { Spinner, ErrorNote } from '@/components/ui';
import { JobCard } from '@/components/JobCard';

export default function RecommendationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<JobRecommendation[]>([]);
  const [algorithm, setAlgorithm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getUser()) { router.push('/login'); return; }
    (async () => {
      try {
        const res = await jobRecommendations(10);
        setItems(res.items);
        setAlgorithm(res.algorithm);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Top 10 Jobs</h1>
        <p className="muted text-sm">
          Max-heap priority queue · highest match score first {algorithm && <span className="text-[10px]">({algorithm})</span>}
        </p>
      </div>

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}

      {!loading && !error && (
        <div className="grid lg:grid-cols-2 gap-4">
          {items.map((it, i) => (
            <div key={it.job.id} className="relative">
              <span className="absolute -top-2 -left-2 z-10 badge font-bold" style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}>
                #{i + 1}
              </span>
              <JobCard item={it} />
            </div>
          ))}
          {items.length === 0 && (
            <div className="card p-8 text-center muted text-sm col-span-2">
              No recommendations yet — add skills to your profile first.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
