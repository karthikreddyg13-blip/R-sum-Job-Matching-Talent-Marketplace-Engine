'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getUser, jobApplicants, updateApplicationStatus } from '@/lib/api';
import { Spinner, ErrorNote, ScorePill, ProgressBar } from '@/components/ui';

type Applicant = {
  application: { id: string; matchScore: number; status: string; appliedAt: string; note?: string };
  candidate: { id: string; name: string; headline: string; location: string; education: string;
    experienceYears: number; skills: string[]; resumeFileName?: string; githubUrl?: string; linkedinUrl?: string; phone?: string };
};

const STATUSES = ['applied', 'review', 'interview', 'offer', 'rejected'];

export default function ApplicantsPage() {
  const params = useParams();
  const jobId = params.id as string;
  const [items, setItems] = useState<Applicant[]>([]);
  const [job, setJob] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    jobApplicants(jobId)
      .then((res) => { setItems(res.items); setJob(res.job); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'recruiter') return;
    load();
  }, [load]);

  const setStatus = async (appId: string, status: string) => {
    try {
      await updateApplicationStatus(jobId, appId, status);
      setItems(items.map((i) => (i.application.id === appId ? { ...i, application: { ...i.application, status } } : i)));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Applicants — {job?.title}</h1>
        <p className="muted text-sm">{items.length} application{items.length === 1 ? '' : 's'}, ranked by match score</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {items.map(({ application, candidate }) => (
          <div key={application.id} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-semibold text-sm">{candidate.name}</div>
                <div className="text-xs muted">{candidate.headline || '—'}</div>
                <div className="text-xs muted">{candidate.location} · {candidate.experienceYears}y · {candidate.education}</div>
                {candidate.resumeFileName && <div className="text-xs mt-1" style={{ color: 'var(--accent)' }}>📄 {candidate.resumeFileName}</div>}
                <div className="text-xs muted mt-1">
                  {candidate.githubUrl && <a href={candidate.githubUrl} target="_blank" className="mr-2 hover:underline">GitHub</a>}
                  {candidate.linkedinUrl && <a href={candidate.linkedinUrl} target="_blank" className="hover:underline">LinkedIn</a>}
                </div>
              </div>
              <ScorePill score={application.matchScore} />
            </div>
            <ProgressBar value={application.matchScore} />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {candidate.skills.map((s) => <span key={s} className="badge">{s}</span>)}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="text-xs muted">Status:</label>
              <select className="input w-36" value={application.status} onChange={(e) => setStatus(application.id, e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="text-xs muted">applied {new Date(application.appliedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="card p-8 text-center muted text-sm lg:col-span-2">No applications yet.</div>
        )}
      </div>
    </div>
  );
}
