'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register, saveSession } from '@/lib/api';
import { ErrorNote } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await register(email, password, role, name);
      saveSession(res.token, res.user);
      router.push(res.user.role === 'candidate' ? '/dashboard' : '/recruiter');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create your account</h1>
      <form onSubmit={submit} className="card p-6 space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`btn ${role === 'candidate' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRole('candidate')}
          >
            👤 I&apos;m a Candidate
          </button>
          <button
            type="button"
            className={`btn ${role === 'recruiter' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setRole('recruiter')}
          >
            🏢 I&apos;m hiring
          </button>
        </div>
        <div>
          <label className="text-xs muted block mb-1">{role === 'candidate' ? 'Full name' : 'Your name (at company)'}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs muted block mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs muted block mb-1">Password (min 6 chars)</label>
          <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : `Register as ${role}`}
        </button>
      </form>
    </div>
  );
}
