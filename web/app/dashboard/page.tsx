'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getUser, myCandidateProfile, updateCandidateProfile, jobRecommendations,
  myApplications, JobRecommendation,
} from '@/lib/api';
import { ProgressBar, Spinner, ErrorNote } from '@/components/ui';
import { SuggestInput } from '@/components/SuggestInput';

interface Profile {
  id: string; name: string; headline: string; location: string;
  education: string; experienceYears: number; skills: string[];
  githubUrl?: string; linkedinUrl?: string; phone?: string;
  resumeText?: string; resumeFileName?: string; resumeUrl?: string; resumeUpdatedAt?: string;
}

export default function CandidateDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [topJobs, setTopJobs] = useState<JobRecommendation[]>([]);
  const [appsCount, setAppsCount] = useState(0);
  const [skillDraft, setSkillDraft] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyGuard, setBusyGuard] = useState(false);

  useEffect(() => {
    if (!getUser()) { router.push('/login'); return; }
    (async () => {
      try {
        const [p, recs, apps] = await Promise.all([
          myCandidateProfile(),
          jobRecommendations(3),
          myApplications(),
        ]);
        setProfile(p as unknown as Profile);
        setTopJobs(recs.items);
        setAppsCount(apps.items.length);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const addSkill = useCallback((s: string) => {
    if (!profile || !s.trim()) return;
    if (profile.skills.some((x) => x.toLowerCase() === s.toLowerCase().trim())) return;
    setProfile({ ...profile, skills: [...profile.skills, s.trim()] });
    setSkillDraft('');
    setSaved(false);
  }, [profile]);

  const removeSkill = (s: string) => {
    if (!profile) return;
    setProfile({ ...profile, skills: profile.skills.filter((x) => x !== s) });
    setSaved(false);
  };

  const save = async () => {
    if (!profile) return;
    setBusyGuard(true);
    try {
      await updateCandidateProfile({
        headline: profile.headline,
        location: profile.location,
        education: profile.education,
        experienceYears: profile.experienceYears,
        skills: profile.skills,
        githubUrl: profile.githubUrl,
        linkedinUrl: profile.linkedinUrl,
        phone: profile.phone,
        resumeText: profile.resumeText,
        resumeFileName: profile.resumeFileName,
        resumeUrl: profile.resumeUrl,
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyGuard(false);
    }
  };

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (!profile) return <ErrorNote message="Could not load profile. Is the API running on :4000?" />;

  const avgScore = topJobs.length ? topJobs.reduce((a, j) => a + j.score, 0) / topJobs.length : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {profile.name.split(' ')[0]} 👋</h1>
          <p className="muted text-sm">Your profile powers the matching engine — keep skills current.</p>
        </div>
        <Link href="/saved" className="btn btn-ghost">★ Saved Jobs</Link>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold">{profile.skills.length}</div>
          <div className="text-xs muted">Skills indexed</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">{avgScore.toFixed(0)}%</div>
          <div className="text-xs muted">Top-3 avg match</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">{appsCount}</div>
          <div className="text-xs muted">Applications</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold">{profile.experienceYears}y</div>
          <div className="text-xs muted">Experience</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-bold mb-4">Your Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs muted block mb-1">Headline</label>
              <input className="input" value={profile.headline} onChange={(e) => { setProfile({ ...profile, headline: e.target.value }); setSaved(false); }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs muted block mb-1">Location</label>
                <input className="input" value={profile.location} onChange={(e) => { setProfile({ ...profile, location: e.target.value }); setSaved(false); }} />
              </div>
              <div>
                <label className="text-xs muted block mb-1">Experience (years)</label>
                <input className="input" type="number" min={0} value={profile.experienceYears} onChange={(e) => { setProfile({ ...profile, experienceYears: Number(e.target.value) }); setSaved(false); }} />
              </div>
            </div>
            <div>
              <label className="text-xs muted block mb-1">Education</label>
              <select className="input" value={profile.education} onChange={(e) => { setProfile({ ...profile, education: e.target.value }); setSaved(false); }}>
                <option value="none">None</option>
                <option value="diploma">Diploma</option>
                <option value="bachelors">Bachelors</option>
                <option value="masters">Masters</option>
                <option value="phd">PhD</option>
              </select>
            </div>
            <div>
              <label className="text-xs muted block mb-1">Skills (trie autocomplete)</label>
              <SuggestInput kind="skill" placeholder="Type to search skills…" value={skillDraft} onChange={setSkillDraft} onPick={addSkill} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.skills.map((s) => (
                  <button key={s} className="badge hover:line-through" onClick={() => removeSkill(s)} title="Click to remove">
                    {s} ✕
                  </button>
                ))}
              </div>
            </div>

            <details className="card p-3" style={{ background: 'var(--bg-soft)' }}>
              <summary className="text-xs font-semibold cursor-pointer">
                📄 Résumé {profile.resumeFileName ? `— ${profile.resumeFileName}` : '(optional)'}
              </summary>
              <div className="space-y-3 mt-3">
                <div>
                  <label className="text-xs muted block mb-1">Résumé file (metadata — pick your file)</label>
                  <input
                    className="input" type="file" accept=".pdf,.doc,.docx,.md,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setProfile({ ...profile, resumeFileName: f.name }); setSaved(false); }
                    }}
                  />
                  {profile.resumeUpdatedAt && (
                    <div className="text-[10px] muted mt-1">last updated {new Date(profile.resumeUpdatedAt).toLocaleString()}</div>
                  )}
                </div>
                <div>
                  <label className="text-xs muted block mb-1">Résumé summary (plain text)</label>
                  <textarea className="input" rows={3} value={profile.resumeText ?? ''} onChange={(e) => { setProfile({ ...profile, resumeText: e.target.value }); setSaved(false); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs muted block mb-1">GitHub</label>
                    <input className="input" value={profile.githubUrl ?? ''} onChange={(e) => { setProfile({ ...profile, githubUrl: e.target.value }); setSaved(false); }} />
                  </div>
                  <div>
                    <label className="text-xs muted block mb-1">LinkedIn</label>
                    <input className="input" value={profile.linkedinUrl ?? ''} onChange={(e) => { setProfile({ ...profile, linkedinUrl: e.target.value }); setSaved(false); }} />
                  </div>
                </div>
              </div>
            </details>

            <div className="flex items-center gap-3 pt-2">
              <button className="btn btn-primary" onClick={save} disabled={busyGuard}>Save profile</button>
              {saved && <span className="text-xs" style={{ color: 'var(--success)' }}>✓ Saved — recommendations re-ranked</span>}
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Top 3 Recommended Jobs</h2>
            <Link href="/recommendations" className="text-xs" style={{ color: 'var(--accent)' }}>see top 10 →</Link>
          </div>
          <div className="space-y-4">
            {topJobs.map((j) => (
              <Link key={j.job.id} href={`/jobs/${j.job.id}`} className="card p-4 block">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm">{j.job.title}</span>
                  <span className="badge">{j.score.toFixed(0)}%</span>
                </div>
                <div className="mt-2"><ProgressBar value={j.score} /></div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {appsCount > 0 && (
        <section className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold">Applications</h2>
            <Link href="/applications" className="text-xs" style={{ color: 'var(--accent)' }}>view all →</Link>
          </div>
        </section>
      )}
    </div>
  );
}
