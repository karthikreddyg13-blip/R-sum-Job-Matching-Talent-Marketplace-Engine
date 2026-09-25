/**
 * Autocomplete service — wraps three Tries (skills, job titles, companies)
 * kept in sync with the store. Popularity weight = how many times a term is
 * referenced (candidates having a skill, jobs with a title, etc.) so the
 * most common suggestions rank first.
 *
 * Case handling: keys are stored lowercased in the trie (so "pyt" matches
 * "Python"); a HashMap maps lowercase -> display casing for output.
 */

import { Trie } from '../dsa/Trie';
import { HashMap } from '../dsa/HashMap';
import { Store } from '../models/Store';

export type AutocompleteKind = 'skill' | 'job' | 'company';

interface TrieBundle {
  trie: Trie;
  display: HashMap<string, string>;
}

function newBundle(): TrieBundle {
  return { trie: new Trie(), display: new HashMap<string, string>() };
}

export class AutocompleteService {
  private skills = newBundle();
  private jobs = newBundle();
  private companies = newBundle();

  constructor(private store: Store) {}

  /** Rebuild all three tries from current data. O(total length of terms). */
  rebuild(): void {
    this.skills = newBundle();
    this.jobs = newBundle();
    this.companies = newBundle();

    for (const c of this.store.db.candidates) {
      for (const s of c.skills) this.insert(this.skills, s, 2);
    }
    for (const j of this.store.db.jobs) {
      for (const s of j.requiredSkills) this.insert(this.skills, s.name, 1);
      this.insert(this.jobs, j.title, 1);
    }
    for (const r of this.store.db.recruiters) {
      this.insert(this.companies, r.companyName, 2);
    }
  }

  private insert(bundle: TrieBundle, term: string, weight: number): void {
    const clean = term.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    bundle.trie.insert(key, weight);
    bundle.display.put(key, clean); // last-seen casing wins; consistent in our data
  }

  suggest(kind: AutocompleteKind, prefix: string, limit = 8): string[] {
    const bundle =
      kind === 'skill' ? this.skills : kind === 'job' ? this.jobs : this.companies;
    return bundle.trie
      .suggest(prefix.trim().toLowerCase(), limit)
      .map((key) => bundle.display.get(key) ?? key);
  }
}
