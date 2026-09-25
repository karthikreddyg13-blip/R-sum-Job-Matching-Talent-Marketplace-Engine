'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, saveSession } from '@/lib/api';
import { ErrorNote } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await login(email, password);
      saveSession(res.token, res.user);
      router.push(res.user.role === 'candidate' ? '/dashboard' : '/recruiter');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (em: string) => {
    setEmail(em);
    setPassword('password123');
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Welcome back</h1>
      <form onSubmit={submit} className="card p-6 space-y-4">
        {error && <ErrorNote message={error} />}
        <div>
          <label className="text-xs muted block mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs muted block mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Login'}
        </button>
      </form>

      <div className="card p-4 mt-4 text-xs muted">
        <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Demo accounts (password123)</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => fill('karthik@example.com')}>Candidate: Karthik (Python/ML)</button>
          <button className="btn btn-ghost" onClick={() => fill('aarav@example.com')}>Candidate: Aarav (Full Stack)</button>
          <button className="btn btn-ghost" onClick={() => fill('hr@nimbussoft.com')}>Recruiter: Nimbus Soft</button>
        </div>
      </div>
    </div>
  );
}
