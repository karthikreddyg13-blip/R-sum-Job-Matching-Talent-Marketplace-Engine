/**
 * ============================================================================
 *  DSA MODULE 4 — SEARCHING ALGORITHMS
 * ============================================================================
 *  All three searching strategies the report requires, on one file so their
 *  complexities can be compared side by side (see docs/DSA-ARCHITECTURE.md).
 *
 *    linearSearch  : O(n)      works on unsorted data
 *    binarySearch  : O(log n)  requires sorted input
 *    jumpSearch    : O(√n)     middle ground, demonstrated for completeness
 * ============================================================================
 */

export interface SearchResult<T> {
  index: number; // -1 when not found
  item: T | null;
  comparisons: number; // instrumentation for the Analytics page
}

/** O(n) — scans every element. Baseline for comparison demos. */
export function linearSearch<T>(arr: T[], predicate: (item: T) => boolean): SearchResult<T> {
  let comparisons = 0;
  for (let i = 0; i < arr.length; i++) {
    comparisons++;
    if (predicate(arr[i])) return { index: i, item: arr[i], comparisons };
  }
  return { index: -1, item: null, comparisons };
}

/** O(log n) — classic binary search on an array sorted by the same key. */
export function binarySearch<T>(arr: T[], key: number, getKey: (item: T) => number): SearchResult<T> {
  let lo = 0;
  let hi = arr.length - 1;
  let comparisons = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    comparisons++;
    const midKey = getKey(arr[mid]);
    if (midKey === key) return { index: mid, item: arr[mid], comparisons };
    if (midKey < key) lo = mid + 1;
    else hi = mid - 1;
  }
  return { index: -1, item: null, comparisons };
}

/** O(√n) — jump ahead in fixed blocks then linear-scan the final block. */
export function jumpSearch<T>(arr: T[], key: number, getKey: (item: T) => number): SearchResult<T> {
  const n = arr.length;
  if (n === 0) return { index: -1, item: null, comparisons: 0 };

  const step = Math.floor(Math.sqrt(n));
  let prev = 0;
  let comparisons = 0;

  while (prev < n && getKey(arr[Math.min(prev + step, n) - 1]) < key) {
    comparisons++;
    prev += step;
  }
  while (prev < Math.min(prev + step, n)) {
    comparisons++;
    if (getKey(arr[prev]) === key) return { index: prev, item: arr[prev], comparisons };
    if (getKey(arr[prev]) > key) break;
    prev++;
  }
  return { index: -1, item: null, comparisons };
}

/**
 * Prefix/substring matching used by the candidate and job search bars.
 * Case-insensitive substring scan — O(n·m) worst case, fast for our sizes.
 */
export function substringMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase().trim());
}
