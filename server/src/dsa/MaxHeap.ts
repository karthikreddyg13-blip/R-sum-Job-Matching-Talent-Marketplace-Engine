/**
 * ============================================================================
 *  DSA MODULE 3 — MAX HEAP / PRIORITY QUEUE
 * ============================================================================
 *  Backs every "Top 10" panel: recommended jobs for a candidate and
 *  recommended candidates for a recruiter. The heap guarantees the highest
 *  match score is always served first with O(log n) extraction.
 *
 *  Complexity:
 *    push  : O(log n)   (amortized O(1) appends + sift-up)
 *    pop   : O(log n)
 *    peek  : O(1)
 *    build from n items (heapify bottom-up) : O(n)
 * ============================================================================
 */

export interface HeapItem {
  score: number;
  id: string;
  payload?: unknown;
}

export class MaxHeap {
  private heap: HeapItem[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  peek(): HeapItem | undefined {
    return this.heap[0];
  }

  /** Insert an item and restore the max-heap invariant via sift-up. */
  push(item: HeapItem): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  /** Remove and return the maximum item; sift-down repairs the heap. */
  pop(): HeapItem | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Build a heap out of an unsorted array in O(n) (bottom-up heapify). */
  static from(items: HeapItem[]): MaxHeap {
    const h = new MaxHeap();
    h.heap = [...items];
    for (let i = Math.floor(h.heap.length / 2) - 1; i >= 0; i--) h.siftDown(i);
    return h;
  }

  /**
   * Convenience: extract the top-k items in descending score order.
   * k·log n total. Ties broken by insertion order (stable via id compare).
   */
  static topK(items: HeapItem[], k: number): HeapItem[] {
    const heap = MaxHeap.from(items);
    const out: HeapItem[] = [];
    while (!heap.isEmpty() && out.length < k) out.push(heap.pop()!);
    return out;
  }

  toArray(): HeapItem[] {
    return [...this.heap];
  }

  // ---------------------------------------------------------------- internals

  private compare(a: HeapItem, b: HeapItem): number {
    // max-priority convention: positive => `a` should be served before `b`
    if (a.score !== b.score) return a.score - b.score; // higher score first
    return b.id.localeCompare(a.id); // stable tie-break: smaller id first
  }

  private siftUp(i: number): void {
    const item = this.heap[i];
    while (i > 0) {
      const parentIdx = (i - 1) >> 1;
      const parent = this.heap[parentIdx];
      if (this.compare(item, parent) <= 0) break;
      this.heap[i] = parent;
      i = parentIdx;
    }
    this.heap[i] = item;
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    const item = this.heap[i];
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let largest = i;

      if (l < n && this.compare(this.heap[l], this.heap[largest]) > 0) largest = l;
      if (r < n && this.compare(this.heap[r], this.heap[largest]) > 0) largest = r;

      if (largest === i) break;
      const tmp = this.heap[i];
      this.heap[i] = this.heap[largest];
      this.heap[largest] = tmp;
      i = largest;
    }
    this.heap[i] = item;
  }
}
