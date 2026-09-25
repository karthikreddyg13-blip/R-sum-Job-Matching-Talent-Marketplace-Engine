/**
 * JSON file-backed persistence (zero-setup default mode).
 * Collection objects are held in memory and flushed to disk lazily
 * (debounced 300ms) so bursts of writes don't thrash the disk.
 *
 * A PostgreSQL schema (schema.sql) ships alongside this for the report and
 * for production deployments — see README "Database modes".
 */

import fs from 'fs';
import path from 'path';
import { DatabaseShape } from './types';

const DEFAULT_DB: DatabaseShape = {
  users: [],
  companies: [],
  skills: [],
  candidates: [],
  recruiters: [],
  jobs: [],
  applications: [],
  savedJobs: [],
  roadmaps: [],
  recommendations: [],
  seq: {},
};

export class Store {
  private file: string;
  private data: DatabaseShape;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'db.json');
    this.data = this.load();
  }

  private load(): DatabaseShape {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseShape;
        return {
          ...structuredClone(DEFAULT_DB),
          ...parsed,
          companies: parsed.companies ?? [],
          skills: parsed.skills ?? [],
          savedJobs: parsed.savedJobs ?? [],
          roadmaps: parsed.roadmaps ?? [],
        };
      }
    } catch (err) {
      console.error('[store] failed to read db.json, starting fresh:', (err as Error).message);
    }
    return structuredClone(DEFAULT_DB);
  }

  get db(): DatabaseShape {
    return this.data;
  }

  /** Monotonic id generator per collection (c1, j2, u3 ...). */
  nextId(prefix: string): string {
    const n = (this.data.seq[prefix] ?? 0) + 1;
    this.data.seq[prefix] = n;
    this.markDirty();
    return `${prefix}${n}`;
  }

  /** Debounced save — coalesces rapid writes into one disk flush. */
  markDirty(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 300);
  }

  /** Immediate flush (called on process exit and after seed). */
  saveNow(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[store] failed to write db.json:', (error_message(err)));
    }
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveNow();
  }
}

// tiny helper so the catch above doesn't need a template literal
function error_message(err: unknown): string {
  return (err as Error).message;
}
