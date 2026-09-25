'use client';

import Link from 'next/link';
import { getUser } from '@/lib/api';
import { useEffect, useState } from 'react';

const FEATURES = [
  { icon: '#', title: 'Hash Map Indexes', desc: 'From-scratch separate-chaining hash table indexes skills, candidates and jobs for O(1) lookups.' },
  { icon: '⌨', title: 'Trie Autocomplete', desc: 'Prefix trie powers skill, job-title and company autocomplete with popularity-weighted suggestions.' },
  { icon: '⛰', title: 'Max-Heap Top-K', desc: 'Binary max heap serves Top 10 recommended jobs & candidates — highest score first, O(k log n).' },
  { icon: '🔗', title: 'Graph Engine', desc: 'BFS/DFS over candidate–skill–job–recruiter graph finds similar jobs, related skills and reach.' },
  { icon: '⇅', title: 'Quicksort Rankings', desc: 'QuickSort (with merge/bubble for comparison) orders every ranked list in the product.' },
  { icon: '🔍', title: 'Search Suite', desc: 'Linear, binary and jump search — benchmarked live on the Analytics page.' },
  { icon: '🧮', title: 'Weighted Matching', desc: '50% required skills + 20% preferred + 15% education + 15% experience, fully transparent breakdown.' },
  { icon: '🗺', title: 'Reverse Resume', desc: 'Skill gap → topologically-ordered learning roadmap with courses, projects and monthly timeline.' },
];

export default function Home() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    const u = getUser();
    if (u) setRole(u.role);
  }, []);

  return (
    <div>
      <section className="text-center py-14">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Résumé–Job Matching &<br />
          <span style={{ color: 'var(--accent)' }}>Talent Marketplace Engine</span>
        </h1>
        <p className="muted mt-4 max-w-2xl mx-auto text-sm md:text-base">
          A startup-grade marketplace where every ranked list is produced by hand-built data
          structures — hash maps, tries, heaps, graphs and sorts — not by the database.
        </p>
        <div className="flex gap-3 justify-center mt-8 flex-wrap">
          {role ? (
            <>
              <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
              <Link href="/recommendations" className="btn btn-ghost">My Recommendations</Link>
            </>
          ) : (
            <>
              <Link href="/register" className="btn btn-primary">Get Started</Link>
              <Link href="/login" className="btn btn-ghost">Login</Link>
            </>
          )}
        </div>
        <p className="text-xs muted mt-6">
          Demo logins (password <code>password123</code>): candidate <code>karthik@example.com</code> ·
          recruiter <code>hr@nimbussoft.com</code>
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
            <p className="text-xs muted">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 mt-10">
        <h2 className="font-bold mb-2">The Matching Formula</h2>
        <p className="text-sm muted">
          Match Score = (Required Skills × 50%) + (Preferred Skills × 20%) + (Education × 15%) + (Experience × 15%)
        </p>
        <p className="text-xs muted mt-2">
          Every recommendation card exposes its full breakdown — transparency is the product.
        </p>
      </section>
    </div>
  );
}
