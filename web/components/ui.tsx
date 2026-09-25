'use client';

/**
 * Shared UI atoms: ThemeToggle (dark/light with localStorage),
 * ProgressBar (match-score visualization) and ScorePill.
 */

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tm_theme');
    const isLight = saved === 'light';
    setLight(isLight);
    document.documentElement.classList.toggle('light', isLight);
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle('light', next);
    localStorage.setItem('tm_theme', next ? 'light' : 'dark');
  };

  return (
    <button className="btn btn-ghost" onClick={toggle} aria-label="Toggle dark mode">
      {light ? '🌙' : '☀️'}
    </button>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs muted mb-1">
          <span>{label}</span>
          <span>{clamped.toFixed(0)}%</span>
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400 border-emerald-500/40' :
    score >= 60 ? 'text-amber-400 border-amber-500/40' :
    'text-rose-400 border-rose-500/40';
  return (
    <span className={`badge ${color} text-sm font-bold`}>{score.toFixed(0)}% match</span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent mr-3" />
      <span className="muted text-sm">{label}</span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="card p-4 text-sm" style={{ borderColor: 'var(--danger)' }}>
      <span style={{ color: 'var(--danger)' }}>⚠ {message}</span>
    </div>
  );
}
