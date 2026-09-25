/**
 * ============================================================================
 *  DSA MODULE 2 — TRIE (PREFIX TREE)
 * ============================================================================
 *  Powers all three autocomplete systems: skills, job titles and companies.
 *
 *  Each node stores a fixed map of children (implemented with a small
 *  array over `a–z0-9+#./ ` characters) plus `isEnd` and weight for ranking
 *  suggestions by popularity.
 *
 *  Complexity:
 *    insert      : O(L)           L = length of the word
 *    search      : O(L)
 *    startsWith  : O(P)           P = length of the prefix
 *    suggest     : O(P + k·L)     k = number of suggestions collected
 *    delete      : O(L)
 * ============================================================================
 */

const CHAR_OFFSET = 32;
const CHAR_RANGE = 95; // covers ' ' (32) .. '~' (126) plus utf16 codes above via modulo

interface TrieNode {
  children: Array<TrieNode | null>;
  isEnd: boolean;
  weight: number;
}

function createNode(): TrieNode {
  return { children: new Array(CHAR_RANGE).fill(null), isEnd: false, weight: 0 };
}

export class Trie {
  private root: TrieNode = createNode();
  private _wordCount = 0;

  get wordCount(): number {
    return this._wordCount;
  }

  /** Convert any char to a child index. Non-ascii chars fold into the tail range. */
  private idx(c: string): number {
    const code = c.charCodeAt(0);
    if (code >= CHAR_OFFSET && code < CHAR_OFFSET + CHAR_RANGE) return code - CHAR_OFFSET;
    return CHAR_RANGE - 1; // collision bucket for exotic chars (rare)
  }

  /** Insert a word. O(L). Repeated inserts increment popularity weight. */
  insert(word: string, weight = 1): void {
    const clean = word.trim();
    if (!clean) return;
    let node = this.root;
    for (const ch of clean) {
      const i = this.idx(ch);
      if (!node.children[i]) node.children[i] = createNode();
      node = node.children[i]!;
    }
    if (!node.isEnd) this._wordCount++;
    node.isEnd = true;
    node.weight += weight;
  }

  /** Exact word membership test. O(L). */
  search(word: string): boolean {
    const node = this.walk(word);
    return !!node && node.isEnd;
  }

  /** Any word begins with this prefix? O(P). */
  startsWith(prefix: string): boolean {
    return !!this.walk(prefix);
  }

  /** All stored words under a prefix — used for "show me everything like X". */
  allWithPrefix(prefix: string): string[] {
    const start = this.walk(prefix);
    const out: string[] = [];
    if (!start) return out;
    this.collect(start, prefix, out);
    return out;
  }

  /**
   * Top-k weighted suggestions for a prefix. Also returns the exact word
   * (when it exists) pinned first so typed words are never lost.
   */
  suggest(prefix: string, limit = 8): string[] {
    const clean = prefix.trim();
    const start = this.walk(clean);
    if (!start) return [];

    const out: string[] = [];
    const stack: Array<{ node: TrieNode; word: string }> = [{ node: start, word: clean }];

    while (stack.length && out.length < limit * 3) {
      const { node, word } = stack.pop()!;
      if (node.isEnd) out.push(word);
      // push children reversed so lighter-weight branches are explored first
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child) {
          const ch = String.fromCharCode(i + CHAR_OFFSET);
          stack.push({ node: child, word: word + ch });
        }
      }
    }

    // rank by weight desc (popularity), then alphabetical
    out.sort((a, b) => {
      const wa = this.weightOf(a);
      const wb = this.weightOf(b);
      if (wb !== wa) return wb - wa;
      return a.localeCompare(b);
    });

    return out.slice(0, limit);
  }

  /** Decrement-style delete: unmark end, prune childless branch upward. O(L). */
  delete(word: string): boolean {
    const clean = word.trim();
    const path: Array<{ node: TrieNode; chIdx: number }> = [];
    let node = this.root;

    for (const ch of clean) {
      const i = this.idx(ch);
      if (!node.children[i]) return false;
      path.push({ node, chIdx: i });
      node = node.children[i]!;
    }
    if (!node.isEnd) return false;

    node.isEnd = false;
    this._wordCount--;

    // prune upwards while nodes are childless and not word-ends
    for (let p = path.length - 1; p >= 0; p--) {
      const { node: parent, chIdx } = path[p];
      const child = parent.children[chIdx]!;
      const hasKids = child.children.some((c) => c !== null);
      if (!child.isEnd && !hasKids) {
        parent.children[chIdx] = null;
      } else {
        break;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- internals

  private walk(prefix: string): TrieNode | null {
    let node = this.root;
    for (const ch of prefix.trim()) {
      const i = this.idx(ch);
      if (!node.children[i]) return null;
      node = node.children[i]!;
    }
    return node;
  }

  private collect(node: TrieNode, word: string, out: string[]): void {
    if (node.isEnd) out.push(word);
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child) this.collect(child, word + String.fromCharCode(i + CHAR_OFFSET), out);
    }
  }

  private weightOf(word: string): number {
    let node = this.root;
    for (const ch of word) {
      const i = this.idx(ch);
      if (!node.children[i]) return 0;
      node = node.children[i]!;
    }
    return node.weight;
  }
}
