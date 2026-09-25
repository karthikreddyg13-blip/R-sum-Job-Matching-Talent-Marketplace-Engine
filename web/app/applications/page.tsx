'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getUser, myApplications } from '@/lib/api';
import { Spinner, ErrorNote, ScorePill } from '@/components/ui';

const STATUS_COLORS: Record<string, string> = {
  applied: 'var(--muted)',
  review: 'var(--warn)',
  interview: 'var(--accent)',
  offer: 'var(--success)',
  rejected: 'var(--danger)',
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Array<{ id: string; jobId: string; matchScore: number; status: string; appliedAt: string; job: { id: string; title: string; location: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getUser()) { router.push('/login'); return; }
    myApplications()
      .then((res) => setItems(res.items))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Applications</h1>
        <p className="muted text-sm">{items.length} total</p>
      </div>

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}

      {!loading && !error && (
        <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {items.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/jobs/${a.jobId}`} className="font-medium text-sm hover:underline">
                  {a.job?.title ?? 'Job removed'}
                </Link>
                <div className="text-xs muted">{a.job?.location} · applied {new Date(a.appliedAt).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge" style={{ borderColor: STATUS_COLORS[a.status], color: STATUS_COLORS[a.status] }}>
                  {a.status}
                </span>
                <ScorePill score={a.matchScore} />
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="p-8 text-center muted text-sm">No applications yet — check your recommendations.</div>
          )}
        </div>
      )}
    </div>
  );
}
