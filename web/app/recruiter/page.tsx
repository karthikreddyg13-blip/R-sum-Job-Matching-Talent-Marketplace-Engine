'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getUser, myCompanyProfile, updateCompanyProfile, getMyJobsWithCounts, deleteJob, Job } from '@/lib/api';
import { Spinner, ErrorNote } from '@/components/ui';

export default function RecruiterDashboard() {
  const router = useRouter();
  const [company, setCompany] = useState<Record<string, string> | null>(null);
  const [jobs, setJobs] = useState<Array<Job & { applicantCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'recruiter') { router.push('/login'); return; }
    Promise.all([myCompanyProfile(), getMyJobsWithCounts()])
      .then(([c, j]) => {
        setCompany(c as Record<string, string>);
        setJobs(j.items);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [router]);

  const saveCompany = async () => {
    if (!company) return;
    try {
      await updateCompanyProfile(company);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This also removes its applications and saved entries.`)) return;
    try {
      await deleteJob(id);
      setJobs(jobs.filter((j) => j.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loading) return <Spinner label="Loading company dashboard…" />;
  if (error) return <ErrorNote message={error} />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{company?.companyName ?? 'Company'}</h1>
          <p className="muted text-sm">{company?.industry} · {company?.location}</p>
        </div>
        <Link href="/recruiter/post" className="btn btn-primary">+ Post a Job</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold">{jobs.length}</div>
          <div className="text-xs muted">Active jobs</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">{jobs.reduce((a, j) => a + (j.applicantCount ?? 0), 0)}</div>
          <div className="text-xs muted">Total applicants</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">{jobs.reduce((a, j) => a + j.requiredSkills.length, 0)}</div>
          <div className="text-xs muted">Skill requirements</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">
            {jobs.length ? Math.round(jobs.reduce((a, j) => a + (j.applicantCount ?? 0), 0) / jobs.length * 10) / 10 : 0}
          </div>
          <div className="text-xs muted">Avg applicants / job</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-bold mb-4">Company Profile</h2>
          {company && (
            <div className="space-y-3">
              <div>
                <label className="text-xs muted block mb-1">Company name</label>
                <input className="input" value={company.companyName ?? ''} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs muted block mb-1">Industry</label>
                  <input className="input" value={company.industry ?? ''} onChange={(e) => setCompany({ ...company, industry: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs muted block mb-1">Location</label>
                  <input className="input" value={company.location ?? ''} onChange={(e) => setCompany({ ...company, location: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs muted block mb-1">Website</label>
                <input className="input" value={company.website ?? ''} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
              </div>
              <div>
                <label className="text-xs muted block mb-1">About</label>
                <textarea className="input" rows={3} value={company.about ?? ''} onChange={(e) => setCompany({ ...company, about: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <button className="btn btn-primary" onClick={saveCompany}>Save</button>
                {saved && <span className="text-xs" style={{ color: 'var(--success)' }}>✓ Saved</span>}
              </div>
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-bold mb-4">Your Job Postings</h2>
          <div className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} className="card p-3" style={{ background: 'var(--bg-soft)' }}>
                <div className="flex justify-between items-start gap-2">
                  <Link href={`/jobs/${j.id}`} className="text-sm font-medium hover:underline">{j.title}</Link>
                  <span className="badge whitespace-nowrap">{j.applicantCount ?? 0} applicants</span>
                </div>
                <div className="text-xs muted mt-1">{j.location} · {j.workMode} · {j.requiredSkills.length} skills</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link className="btn btn-ghost text-xs" href={`/recruiter/jobs/${j.id}/applicants`}>Applicants</Link>
                  <Link className="btn btn-ghost text-xs" href={`/recruiter/jobs/${j.id}/candidates`}>Rank candidates</Link>
                  <Link className="btn btn-ghost text-xs" href={`/recruiter/jobs/${j.id}/edit`}>Edit</Link>
                  <button className="btn btn-ghost text-xs" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(j.id, j.title)}>Delete</button>
                </div>
              </div>
            ))}
            {jobs.length === 0 && <div className="text-xs muted">No jobs yet — post your first one.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
