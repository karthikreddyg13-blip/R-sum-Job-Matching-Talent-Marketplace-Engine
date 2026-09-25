/**
 * ============================================================================
 *  DSA MODULE 6 — GRAPH / RECOMMENDATION ENGINE
 * ============================================================================
 *  The relationship graph is the intellectual core connecting candidates,
 *  jobs, recruiters and skills. Nodes are entities; edges carry a relation
 *  type and weight. Traversals (BFS/DFS) drive three product features:
 *
 *    1. Similar jobs       — BFS over shared skills / company
 *    2. Related skills     — co-occurrence edges mined from job postings
 *    3. Candidate-job reach — multi-hop discovery beyond direct matches
 *
 *  Storage: adjacency map (HashMap from node key -> edge list). BFS is
 *  implemented with an explicit queue; DFS with an explicit stack so the
 *  recursion depth never becomes an issue.
 *
 *  Complexity:
 *    addNode / addEdge : O(1) average
 *    BFS / DFS         : O(V + E)
 * ============================================================================
 */

export type NodeType = 'candidate' | 'job' | 'recruiter' | 'skill';
export type RelationType =
  | 'has_skill'      // candidate -> skill  (weight = proficiency 1..5)
  | 'requires_skill' // job -> skill        (weight = required 3..5 / preferred 1..2)
  | 'posted_by'      // job -> recruiter
  | 'similar_to';    // job <-> job (transitive, computed lazily)

export interface GraphNode {
  key: string;        // e.g. "candidate:u1", "job:j1", "skill:python"
  type: NodeType;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: RelationType;
  weight: number;
}

export class EntityGraph {
  private adjacency: Map<string, GraphEdge[]> = new Map();
  private nodes: Map<string, GraphNode> = new Map();

  addNode(node: GraphNode): void {
    if (!this.nodes.has(node.key)) {
      this.nodes.set(node.key, node);
      this.adjacency.set(node.key, []);
    }
  }

  addEdge(edge: GraphEdge): void {
    this.addNode({ key: edge.from, type: 'skill', label: edge.from }); // ensure endpoints exist
    this.addNode({ key: edge.to, type: 'skill', label: edge.to });
    this.adjacency.get(edge.from)!.push(edge);
    // maintain undirected twin for reverse traversals
    this.adjacency.get(edge.to)!.push({ ...edge, from: edge.to, to: edge.from });
  }

  hasNode(key: string): boolean {
    return this.nodes.has(key);
  }

  node(key: string): GraphNode | undefined {
    return this.nodes.get(key);
  }

  neighbors(key: string): GraphEdge[] {
    return this.adjacency.get(key) ?? [];
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    let total = 0;
    for (const edges of this.adjacency.values()) total += edges.length;
    return total;
  }

  /**
   * Breadth-first search from a start node.
   * Returns nodes grouped by hop distance (1 = direct neighbors, 2 = two hops...).
   * O(V + E). Deterministic order (insertion order of edges).
   */
  bfs(start: string, maxDepth = 2): Map<number, string[]> {
    const visited = new Set<string>([start]);
    const levels = new Map<number, string[]>();
    const queue: Array<{ key: string; depth: number }> = [{ key: start, depth: 0 }];

    while (queue.length > 0) {
      const { key, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;
      const nextDepth = depth + 1;
      for (const edge of this.adjacency.get(key) ?? []) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        if (!levels.has(nextDepth)) levels.set(nextDepth, []);
        levels.get(nextDepth)!.push(edge.to);
        queue.push({ key: edge.to, depth: nextDepth });
      }
    }
    return levels;
  }

  /**
   * Depth-first search collecting all reachable node keys.
   * Iterative (explicit stack) — safe for large graphs. O(V + E).
   */
  dfs(start: string): string[] {
    const visited = new Set<string>();
    const stack: string[] = [start];
    const out: string[] = [];

    while (stack.length > 0) {
      const key = stack.pop()!;
      if (visited.has(key)) continue;
      visited.add(key);
      out.push(key);
      for (const edge of this.adjacency.get(key) ?? []) {
        if (!visited.has(edge.to)) stack.push(edge.to);
      }
    }
    return out;
  }

  /**
   * FEATURE: similar jobs for a given job.
   * 1-hop: jobs sharing any skill. 2-hop: jobs connected through the
   * skill->job chains. Scores = number of shared skills (Jaccard-like).
   */
  similarJobs(jobKey: string, limit = 6): Array<{ key: string; sharedSkills: number }> {
    const scores: Array<{ key: string; sharedSkills: number }> = [];
    const levels = this.bfs(jobKey, 2);
    const seen = new Set<string>();

    for (const [depth, keys] of levels) {
      for (const key of keys) {
        if (!key.startsWith('job:') || key === jobKey || seen.has(key)) continue;
        seen.add(key);
        const shared = this.sharedSkillCount(jobKey, key);
        if (shared > 0) scores.push({ key, sharedSkills: shared + (depth === 1 ? 0.5 : 0) });
      }
    }
    scores.sort((a, b) => b.sharedSkills - a.sharedSkills);
    return scores.slice(0, limit);
  }

  /**
   * FEATURE: related skills — which skills co-occur most with the target
   * skill across all job requirements. Drives "students also learn" chips.
   */
  relatedSkills(skillKey: string, limit = 6): Array<{ key: string; strength: number }> {
    const strength: Map<string, number> = new Map();
    const levels = this.bfs(skillKey, 2);

    for (const keys of levels.values()) {
      for (const key of keys) {
        if (!key.startsWith('job:')) continue;
        for (const edge of this.adjacency.get(key) ?? []) {
          if (edge.relation !== 'requires_skill' || edge.to === skillKey) continue;
          if (!edge.to.startsWith('skill:')) continue;
          strength.set(edge.to, (strength.get(edge.to) ?? 0) + edge.weight);
        }
      }
    }

    return [...strength.entries()]
      .map(([key, s]) => ({ key, strength: s }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);
  }

  /**
   * FEATURE: candidate reachability — how many jobs a candidate can reach
   * through their skills within N hops. Feeds the dashboard "reach" metric.
   */
  candidateReach(candidateKey: string, maxDepth = 2): number {
    const levels = this.bfs(candidateKey, maxDepth);
    let jobs = 0;
    for (const keys of levels.values()) {
      for (const key of keys) if (key.startsWith('job:')) jobs++;
    }
    return jobs;
  }

  /** Count skills shared between two jobs via their require_skill edges. */
  private sharedSkillCount(jobA: string, jobB: string): number {
    const a = new Set<string>();
    for (const e of this.adjacency.get(jobA) ?? []) if (e.relation === 'requires_skill') a.add(e.to);
    let shared = 0;
    for (const e of this.adjacency.get(jobB) ?? []) {
      if (e.relation === 'requires_skill' && a.has(e.to)) shared++;
    }
    return shared;
  }

  /** Snapshot for the /api/analytics/graph endpoint (front-end visualization). */
  snapshot(maxNodes = 120): { nodes: Array<{ key: string; type: NodeType; label: string }>; edges: Array<{ from: string; to: string; relation: RelationType }> } {
    const nodes: Array<{ key: string; type: NodeType; label: string }> = [];
    const edges: Array<{ from: string; to: string; relation: RelationType }> = [];
    let count = 0;
    for (const [key, node] of this.nodes) {
      if (count++ >= maxNodes) break;
      nodes.push({ key, type: node.type, label: node.label });
    }
    const nodeSet = new Set(nodes.map((n) => n.key));
    const added = new Set<string>();
    for (const [from, list] of this.adjacency) {
      if (!nodeSet.has(from)) continue;
      for (const e of list) {
        if (!nodeSet.has(e.to)) continue;
        const sig = [from, e.to].sort().join('->') + e.relation;
        if (added.has(sig)) continue;
        added.add(sig);
        edges.push({ from, to: e.to, relation: e.relation });
      }
    }
    return { nodes, edges };
  }
}
