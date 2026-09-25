'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUser, jobDetail, Job, SkillReq } from '@/lib/api';
import { Spinner, ErrorNote } from '@/components/ui';
import { JobForm } from '@/components/JobForm';

export default function EditJobPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'recruiter') { router.push('/login'); return; }
    jobDetail(id)
      .then((res) => setJob(res.job))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <Spinner />;
  if (error || !job) return <ErrorNote message={error || 'Job not found'} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Edit Job</h1>
      <JobForm
        jobId={job.id}
        initial={{
          title: job.title,
          description: job.description,
          location: job.location,
          workMode: job.workMode,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          minEducation: job.minEducation,
          minExperienceYears: job.minExperienceYears,
          requiredSkills: job.requiredSkills as SkillReq[],
        }}
      />
    </div>
  );
}
