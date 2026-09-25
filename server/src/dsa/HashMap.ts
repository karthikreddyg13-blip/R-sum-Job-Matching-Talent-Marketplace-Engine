/**
 * ============================================================================
 *  DSA MODULE 1 — HASH MAP / HASH TABLE
 * ============================================================================
 *  A from-scratch separate-chaining hash table built on a fixed array of
 *  buckets. Used for O(1) average-case lookups of skills, candidate indexes
 *  and job indexes across the whole engine.
 *
 *  Why not JS `Map`? For academic evaluation we demonstrate the underlying
 *  mechanics: hash function, collisions, chaining, load factor and dynamic
 *  rehashing.
 *
 *  Complexity:
 *    put / get / delete : O(1) average, O(n) worst (all keys in one bucket)
 *    keys / values      : O(n + capacity)
 *    rehash             : O(n)
 * ============================================================================
 */

export class HashEntry<K, V> {
  constructor(public key: K, public value: V) {}
}

export class HashMap<K, V> {
  private buckets: Array<Array<HashEntry<K, V>>>;
  private _size = 0;

  constructor(private capacity = 16, private readonly maxLoadFactor = 0.75) {
    if (capacity < 1) capacity = 1;
    this.buckets = new Array(capacity).fill(null).map(() => []);
  }

  /** Polynomial rolling hash (horner's method) — good distribution for strings. */
  private hash(key: K): number {
    const raw = typeof key === 'string' ? key.toLowerCase().trim() : String(key);
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = (h * 33) ^ raw.charCodeAt(i); // xor-variant of DJB2
    }
    // force 32-bit then map into bucket range
    return (h >>> 0) % this.capacity;
  }

  get size(): number {
    return this._size;
  }

  get loadFactor(): number {
    return this._size / this.capacity;
  }

  /** Insert or update. O(1) average. Triggers rehash when load factor exceeded. */
  put(key: K, value: V): void {
    if (this.loadFactor >= this.maxLoadFactor) this.rehash(this.capacity * 2);

    const idx = this.hash(key);
    const chain = this.buckets[idx];
    for (const entry of chain) {
      if (this.keysEqual(entry.key, key)) {
        entry.value = value; // update existing
        return;
      }
    }
    chain.push(new HashEntry(key, value));
    this._size++;
  }

  /** Retrieve. O(1) average. Returns undefined when absent. */
  get(key: K): V | undefined {
    const idx = this.hash(key);
    const chain = this.buckets[idx];
    for (const entry of chain) {
      if (this.keysEqual(entry.key, key)) return entry.value;
    }
    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /** Delete. O(1) average. Returns true when a pair was removed. */
  delete(key: K): boolean {
    const idx = this.hash(key);
    const chain = this.buckets[idx];
    for (let i = 0; i < chain.length; i++) {
      if (this.keysEqual(chain[i].key, key)) {
        chain.splice(i, 1);
        this._size--;
        return true;
      }
    }
    return false;
  }

  /** Double the bucket array and re-distribute every entry. O(n). */
  private rehash(newCapacity: number): void {
    const oldBuckets = this.buckets;
    this.capacity = newCapacity;
    this.buckets = new Array(newCapacity).fill(null).map(() => []);
    this._size = 0;
    for (const chain of oldBuckets) {
      for (const entry of chain) this.put(entry.key, entry.value);
    }
  }

  private keysEqual(a: K, b: K): boolean {
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase().trim() === b.toLowerCase().trim();
    }
    return a === b;
  }

  keys(): K[] {
    const out: K[] = [];
    for (const chain of this.buckets) for (const e of chain) out.push(e.key);
    return out;
  }

  values(): V[] {
    const out: V[] = [];
    for (const chain of this.buckets) for (const e of chain) out.push(e.value);
    return out;
  }

  entries(): Array<[K, V]> {
    const out: Array<[K, V]> = [];
    for (const chain of this.buckets) for (const e of chain) out.push([e.key, e.value]);
    return out;
  }

  /** Iterate all entries with a callback (avoids allocating arrays in hot paths). */
  forEach(fn: (key: K, value: V) => void): void {
    for (const chain of this.buckets) for (const e of chain) fn(e.key, e.value);
  }

  /** Number of entries in the longest chain — useful to demo collision quality. */
  longestChain(): number {
    let max = 0;
    for (const chain of this.buckets) max = Math.max(max, chain.length);
    return max;
  }

  clear(): void {
    this.buckets = new Array(this.capacity).fill(null).map(() => []);
    this._size = 0;
  }
}
