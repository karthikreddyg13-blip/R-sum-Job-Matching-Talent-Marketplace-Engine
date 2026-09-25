'use client';

/**
 * Shared job form used by both "Post a Job" and "Edit Job".
 * Weights: 1–2 preferred, 3–5 required (drives the 50/20 matching split).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postJob, updateJob, SkillReq } from '@/lib/api';
import { ErrorNote } from '@/components/ui';
import { SuggestInput } from '@/components/SuggestInput';

export function JobForm({
  jobId,
  initial,
}: {
  jobId?: string;
  initial?: {
    title: string; description: string; location: string; workMode: string;
    salaryMin?: number; salaryMax?: number; minEducation: string;
    minExperienceYears: number; requiredSkills: SkillReq[];
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [workMode, setWorkMode] = useState(initial?.workMode ?? 'onsite');
  const [salaryMin, setSalaryMin] = useState(initial?.salaryMin?.toString() ?? '');
  const [salaryMax, setSalaryMax] = useState(initial?.salaryMax?.toString() ?? '');
  const [minEducation, setMinEducation] = useState(initial?.minEducation ?? 'bachelors');
  const [minExp, setMinExp] = useState(initial?.minExperienceYears?.toString() ?? '0');
  const [skills, setSkills] = useState<SkillReq[]>(initial?.requiredSkills ?? []);
  const [skillDraft, setSkillDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addSkill = (s: string) => {
    const name = s.trim();
    if (!name || skills.some((x) => x.name.toLowerCase() === name.toLowerCase())) return;
    setSkills([...skills, { name, weight: 3 }]);
    setSkillDraft('');
  };

  const setWeight = (name: string, weight: number) =>
    setSkills(skills.map((s) => (s.name === name ? { ...s, weight } : s)));

  const removeSkill = (name: string) => setSkills(skills.filter((s) => s.name !== name));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        title, description, location, workMode,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        minEducation,
        minExperienceYears: Number(minExp),
        requiredSkills: skills,
      };
      if (jobId) {
        await updateJob(jobId, payload);
        router.push('/recruiter');
      } else {
        await postJob(payload);
        router.push('/recruiter');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      {error && <ErrorNote message={error} />}
      <div>
        <label className="text-xs muted block mb-1">Job title</label>
        <SuggestInput kind="job" placeholder="e.g. Backend Engineer" value={title} onChange={setTitle} />
      </div>
      <div>
        <label className="text-xs muted block mb-1">Description</label>
        <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs muted block mb-1">Location</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className="text-xs muted block mb-1">Work mode</label>
          <select className="input" value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
            <option value="onsite">Onsite</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label className="text-xs muted block mb-1">Salary min (₹/yr)</label>
          <input className="input" type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
        </div>
        <div>
          <label className="text-xs muted block mb-1">Salary max (₹/yr)</label>
          <input className="input" type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
        </div>
        <div>
          <label className="text-xs muted block mb-1">Min education</label>
          <select className="input" value={minEducation} onChange={(e) => setMinEducation(e.target.value)}>
            <option value="none">None</option>
            <option value="diploma">Diploma</option>
            <option value="bachelors">Bachelors</option>
            <option value="masters">Masters</option>
            <option value="phd">PhD</option>
          </select>
        </div>
        <div>
          <label className="text-xs muted block mb-1">Min experience (years)</label>
          <input className="input" type="number" min={0} value={minExp} onChange={(e) => setMinExp(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-xs muted block mb-1">Skills (weight 3–5 = required, 1–2 = preferred)</label>
        <SuggestInput kind="skill" placeholder="Type a skill and pick from suggestions…" value={skillDraft} onChange={setSkillDraft} onPick={addSkill} />
        <div className="space-y-2 mt-3">
          {skills.map((s) => (
            <div key={s.name} className="flex items-center gap-3 card p-2.5" style={{ background: 'var(--bg-soft)' }}>
              <span className="text-sm flex-1">{s.name}</span>
              <select className="input w-40" value={s.weight} onChange={(e) => setWeight(s.name, Number(e.target.value))}>
                <option value={1}>1 · nice to have</option>
                <option value={2}>2 · preferred</option>
                <option value={3}>3 · required</option>
                <option value={4}>4 · strong</option>
                <option value={5}>5 · must have</option>
              </select>
              <button type="button" className="btn btn-ghost" onClick={() => removeSkill(s.name)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-primary w-full" disabled={busy || !title || skills.length === 0}>
        {busy ? 'Saving…' : jobId ? 'Save changes' : 'Publish job'}
      </button>
    </form>
  );
}
