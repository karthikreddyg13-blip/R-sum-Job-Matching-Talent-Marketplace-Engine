'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/api';
import { JobForm } from '@/components/JobForm';

export default function PostJobPage() {
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'recruiter') router.push('/login');
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Post a Job</h1>
      <JobForm />
    </div>
  );
}
