/**
 * ============================================================================
 *  DSA MODULE 5 — SORTING ALGORITHMS
 * ============================================================================
 *  Implementations used for every ranked list the product shows. The engine
 *  never delegates ordering to the database — results come out of the DSA
 *  layer already sorted.
 *
 *    quickSort : O(n log n) average, in-place, primary engine sort
 *    mergeSort : O(n log n) guaranteed, stable — used when tie order matters
 *    bubbleSort: O(n²) — kept only for the Analytics complexity comparison
 * ============================================================================
 */

export type SortKey = 'matchScore' | 'experience' | 'skillCount' | 'salary' | 'recency';

export interface SortableCandidate {
  id: string;
  matchScore?: number;
  experienceYears?: number;
  skillCount?: number;
  [k: string]: unknown;
}

export interface SortableJob {
  id: string;
  matchScore?: number;
  salaryMax?: number;
  postedAt?: string;
  skillCount?: number;
  [k: string]: unknown;
}

export interface SortMetrics {
  comparisons: number;
  swaps: number;
  timeMs: number;
}

function metricsStart(): number {
  return Date.now();
}

function metricsEnd(m: SortMetrics, start: number): SortMetrics {
  m.timeMs = Date.now() - start;
  return m;
}

// ---------------------------------------------------------------- quick sort

/** In-place quicksort with median-of-three pivot; average O(n log n). */
export function quickSort<T>(arr: T[], cmp: (a: T, b: T) => number): { sorted: T[]; metrics: SortMetrics } {
  const sorted = [...arr]; // never mutate caller's array
  const m: SortMetrics = { comparisons: 0, swaps: 0, timeMs: 0 };
  const start = metricsStart();

  const partition = (lo: number, hi: number): number => {
    const mid = lo + ((hi - lo) >> 1);
    // median-of-three: order arr[lo], arr[mid], arr[hi]
    if (cmp(sorted[mid], sorted[lo]) < 0) { [sorted[lo], sorted[mid]] = [sorted[mid], sorted[lo]]; m.swaps++; }
    if (cmp(sorted[hi], sorted[lo]) < 0) { [sorted[lo], sorted[hi]] = [sorted[hi], sorted[lo]]; m.swaps++; }
    if (cmp(sorted[hi], sorted[mid]) < 0) { [sorted[mid], sorted[hi]] = [sorted[hi], sorted[mid]]; m.swaps++; }
    const pivot = sorted[mid];

    let i = lo;
    let j = hi;
    while (i <= j) {
      while (cmp(sorted[i], pivot) < 0) { i++; m.comparisons++; }
      m.comparisons++;
      while (cmp(sorted[j], pivot) > 0) { j--; m.comparisons++; }
      m.comparisons++;
      if (i <= j) {
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        m.swaps++;
        i++;
        j--;
      }
    }
    return i;
  };

  const sort = (lo: number, hi: number): void => {
    if (lo >= hi) return;
    const p = partition(lo, hi);
    sort(lo, p - 1);
    sort(p, hi);
  };

  sort(0, sorted.length - 1);
  return { sorted, metrics: metricsEnd(m, start) };
}

// ---------------------------------------------------------------- merge sort

/** Stable bottom-up-friendly merge sort; O(n log n) guaranteed. */
export function mergeSort<T>(arr: T[], cmp: (a: T, b: T) => number): { sorted: T[]; metrics: SortMetrics } {
  const m: SortMetrics = { comparisons: 0, swaps: 0, timeMs: 0 };
  const start = metricsStart();

  const merge = (left: T[], right: T[]): T[] => {
    const out: T[] = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      m.comparisons++;
      if (cmp(left[i], right[j]) <= 0) out.push(left[i++]);
      else out.push(right[j++]);
    }
    while (i < left.length) out.push(left[i++]);
    while (j < right.length) out.push(right[j++]);
    return out;
  };

  const sort = (items: T[]): T[] => {
    if (items.length <= 1) return items;
    const mid = items.length >> 1;
    return merge(sort(items.slice(0, mid)), sort(items.slice(mid)));
  };

  const sorted = sort([...arr]);
  return { sorted, metrics: metricsEnd(m, start) };
}

// --------------------------------------------------------------- bubble sort

/** O(n²) reference implementation — Analytics page plots it against O(n log n). */
export function bubbleSort<T>(arr: T[], cmp: (a: T, b: T) => number): { sorted: T[]; metrics: SortMetrics } {
  const sorted = [...arr];
  const m: SortMetrics = { comparisons: 0, swaps: 0, timeMs: 0 };
  const start = metricsStart();

  for (let i = 0; sorted.length && i < sorted.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < sorted.length - 1 - i; j++) {
      m.comparisons++;
      if (cmp(sorted[j], sorted[j + 1]) > 0) {
        [sorted[j], sorted[j + 1]] = [sorted[j + 1], sorted[j]];
        m.swaps++;
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return { sorted, metrics: metricsEnd(m, start) };
}

// ------------------------------------------------------------ domain sorters

/** Comparator factory shared by the recommendation endpoints. */
export function makeComparator(
  key: SortKey,
  dir: 'asc' | 'desc' = 'desc'
): (a: Record<string, unknown>, b: Record<string, unknown>) => number {
  const sign = dir === 'desc' ? -1 : 1;
  return (a, b) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (typeof av === 'string' && typeof bv === 'string') return sign * av.localeCompare(bv);
    return sign * ((av as number) - (bv as number));
  };
}

export function sortByKey<T extends Record<string, unknown>>(
  items: T[],
  key: SortKey,
  dir: 'asc' | 'desc' = 'desc'
): { sorted: T[]; metrics: SortMetrics } {
  const cmp = makeComparator(key, dir);
  return quickSort(items, cmp as (a: T, b: T) => number);
}
