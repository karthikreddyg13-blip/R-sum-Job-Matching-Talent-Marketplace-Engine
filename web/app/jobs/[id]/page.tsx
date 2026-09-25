'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { jobDetail, Job } from '@/lib/api';
import { Spinner, ErrorNote, ScorePill } from '@/components/ui';

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [similar, setSimilar] = useState<Array<{ jobId: string; title: string; sharedSkills: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await jobDetail(id);
        setJob(res.job);
        setSimilar(res.similar);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner />;
  if (error || !job) return <ErrorNote message={error || 'Job not found'} />;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="card p-6">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="text-xs muted mt-1">
            {job.location} · {job.workMode} · {job.minExperienceYears}+ yrs · min {job.minEducation}
            {job.salaryMax ? ` · ₹${(job.salaryMin ?? 0) / 100000}–${job.salaryMax / 100000} LPA` : ''}
          </div>
          <p className="text-sm mt-4">{job.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {job.requiredSkills.map((s) => (
              <span key={s.name} className="badge">
                {s.name} · w{s.weight}
              </span>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card p-5">
          <h3 className="font-semibold text-sm mb-3">Similar Jobs <span className="muted text-xs">(graph BFS)</span></h3>
          <div className="space-y-2">
            {similar.map((s) => (
              <Link key={s.jobId} href={`/jobs/${s.jobId}`} className="block card p-3 hover:opacity-80" style={{ background: 'var(--bg-soft)' }}>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs muted">{s.sharedSkills} shared skills</div>
              </Link>
            ))}
            {similar.length === 0 && <div className="text-xs muted">No similar jobs found.</div>}
          </div>
        </section>
      </aside>
    </div>
  );
}
