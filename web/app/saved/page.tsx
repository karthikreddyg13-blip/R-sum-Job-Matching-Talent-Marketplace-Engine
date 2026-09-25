'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getUser, savedJobs, unsaveJob, applyToJob, Job } from '@/lib/api';
import { Spinner, ErrorNote } from '@/components/ui';

export default function SavedJobsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Array<{ savedAt: string; job: Job }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    savedJobs()
      .then((res) => setItems(res.items))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!getUser()) { router.push('/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const unsave = async (id: string) => {
    await unsaveJob(id);
    setItems(items.filter((i) => i.job.id !== id));
  };

  const apply = async (id: string) => {
    try {
      await applyToJob(id);
      alert('Application submitted!');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved Jobs</h1>
        <p className="muted text-sm">{items.length} job{items.length === 1 ? '' : 's'} bookmarked</p>
      </div>

      {loading && <Spinner />}
      {error && <ErrorNote message={error} />}

      {!loading && !error && (
        <div className="grid lg:grid-cols-2 gap-4">
          {items.map(({ job, savedAt }) => (
            <div key={job.id} className="card p-5">
              <div className="flex justify-between items-start mb-2">
                <Link href={`/jobs/${job.id}`} className="font-semibold hover:underline">{job.title}</Link>
                <span className="badge">saved {new Date(savedAt).toLocaleDateString()}</span>
              </div>
              <div className="text-xs muted">{job.location} · {job.workMode} · {job.minExperienceYears}+ yrs</div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {job.requiredSkills.map((s) => <span key={s.name} className="badge">{s.name}</span>)}
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-primary" onClick={() => apply(job.id)}>Apply</button>
                <button className="btn btn-ghost" onClick={() => unsave(job.id)}>Remove</button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="card p-8 text-center muted text-sm lg:col-span-2">
              No saved jobs yet — use the ☆ Save button on any job card.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
