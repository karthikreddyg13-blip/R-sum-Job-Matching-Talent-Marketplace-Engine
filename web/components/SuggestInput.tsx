'use client';

/**
 * Autocomplete input backed by the server-side Trie.
 * De-bounced 180ms; shows top suggestions in a dropdown.
 */

import { useEffect, useRef, useState } from 'react';
import { autocomplete } from '@/lib/api';

export function SuggestInput({
  kind,
  placeholder,
  onPick,
  value,
  onChange,
}: {
  kind: 'skill' | 'job' | 'company';
  placeholder?: string;
  onPick?: (suggestion: string) => void;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [text, setText] = useState(value ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<{ timeMs: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) setText(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (text.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await autocomplete(kind, text);
        setSuggestions(res.suggestions);
        setMeta(res.meta);
        setOpen(res.suggestions.length > 0);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(handler);
  }, [text, kind]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const pick = (s: string) => {
    setText(s);
    setOpen(false);
    onPick?.(s);
    onChange?.(s);
  };

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(e.target.value);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
      />
      {open && (
        <div
          className="absolute z-30 mt-1 w-full card overflow-hidden"
          style={{ background: 'var(--card)' }}
        >
          {suggestions.map((s) => (
            <button
              key={s}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-indigo-500/10"
              style={{ color: 'var(--text)' }}
              onClick={() => pick(s)}
            >
              {s}
            </button>
          ))}
          {meta && (
            <div className="px-3 py-1 text-[10px] muted border-t" style={{ borderColor: 'var(--border)' }}>
              trie lookup · {meta.timeMs}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
}
