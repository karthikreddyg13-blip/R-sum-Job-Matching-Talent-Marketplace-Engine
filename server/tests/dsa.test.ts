/**
 * DSA unit tests — run with: npm test (from talentmatch/server)
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { HashMap } from '../src/dsa/HashMap';
import { Trie } from '../src/dsa/Trie';
import { MaxHeap } from '../src/dsa/MaxHeap';
import { linearSearch, binarySearch, jumpSearch } from '../src/dsa/Searching';
import { quickSort, mergeSort, bubbleSort } from '../src/dsa/Sorting';
import { EntityGraph } from '../src/dsa/EntityGraph';
import { MatchingEngine } from '../src/services/MatchingEngine';

// ---------------- HashMap ----------------

test('HashMap: put/get/update basics', () => {
  const m = new HashMap<string, number>(4);
  m.put('python', 1);
  m.put('java', 2);
  assert.equal(m.get('python'), 1);
  assert.equal(m.get('java'), 2);
  m.put('python', 9); // update
  assert.equal(m.get('python'), 9);
  assert.equal(m.size, 2);
});

test('HashMap: case-insensitive lookup', () => {
  const m = new HashMap<string, boolean>();
  m.put('Python', true);
  assert.equal(m.get('python'), true);
  assert.equal(m.get('  PYTHON '), true);
});

test('HashMap: rehash keeps all entries', () => {
  const m = new HashMap<string, number>(2);
  for (let i = 0; i < 100; i++) m.put(`key-${i}`, i);
  assert.equal(m.size, 100);
  for (let i = 0; i < 100; i++) assert.equal(m.get(`key-${i}`), i);
  assert.ok(m.loadFactor <= 0.75);
});

test('HashMap: delete', () => {
  const m = new HashMap<string, number>();
  m.put('a', 1);
  assert.ok(m.delete('a'));
  assert.equal(m.has('a'), false);
  assert.equal(m.size, 0);
});

// ---------------- Trie ----------------

test('Trie: prefix suggestions', () => {
  const t = new Trie();
  t.insert('Python');
  t.insert('Python Developer');
  t.insert('Python Engineer');
  t.insert('Java');
  const s = t.suggest('Pyt');
  assert.ok(s.includes('Python'));
  assert.ok(s.includes('Python Developer'));
  assert.ok(s.includes('Python Engineer'));
  assert.ok(!s.includes('Java'));
});

test('Trie: weighted ranking puts popular terms first', () => {
  const t = new Trie();
  t.insert('JavaScript', 1);
  for (let i = 0; i < 10; i++) t.insert('Java', 1); // heavier weight
  const s = t.suggest('Jav');
  assert.equal(s[0], 'Java');
});

test('Trie: search and startsWith', () => {
  const t = new Trie();
  t.insert('React');
  assert.ok(t.search('React'));
  assert.ok(!t.search('Rea'));
  assert.ok(t.startsWith('Rea'));
});

test('Trie: delete prunes branches', () => {
  const t = new Trie();
  t.insert('Figma');
  t.insert('Figma Advanced');
  assert.ok(t.delete('Figma'));
  assert.ok(!t.search('Figma'));
  assert.ok(t.search('Figma Advanced')); // longer word survives
  assert.equal(t.wordCount, 1);
});

// ---------------- MaxHeap ----------------

test('MaxHeap: pops in descending score order', () => {
  const h = new MaxHeap();
  h.push({ id: 'a', score: 30 });
  h.push({ id: 'b', score: 80 });
  h.push({ id: 'c', score: 50 });
  assert.equal(h.pop()!.id, 'b');
  assert.equal(h.pop()!.id, 'c');
  assert.equal(h.pop()!.id, 'a');
});

test('MaxHeap: topK works', () => {
  const items = [10, 90, 40, 70, 20, 60].map((s, i) => ({ id: `i${i}`, score: s }));
  const top = MaxHeap.topK(items, 3);
  assert.deepEqual(top.map((t) => t.score), [90, 70, 60]);
});

test('MaxHeap: ties broken stably by id', () => {
  const items = [
    { id: 'b', score: 50 },
    { id: 'a', score: 50 },
  ];
  const top = MaxHeap.topK(items, 2);
  assert.equal(top[0].id, 'a');
});

// ---------------- Searching ----------------

test('Searching: linear finds first match', () => {
  const arr = [5, 3, 8, 3];
  const r = linearSearch(arr, (x) => x === 3);
  assert.equal(r.index, 1);
  assert.equal(r.comparisons, 2);
});

test('Searching: binary search on sorted data', () => {
  const arr = [1, 3, 5, 7, 9, 11].map((k, i) => ({ k, i }));
  const r = binarySearch(arr, 9, (x) => x.k);
  assert.equal(r.index, 4);
  assert.ok(r.comparisons <= 3);
});

test('Searching: jump search finds target', () => {
  const arr = Array.from({ length: 100 }, (_, i) => ({ k: i }));
  const r = jumpSearch(arr, 55, (x) => x.k);
  assert.equal(r.index, 55);
});

test('Searching: not found returns -1', () => {
  const arr = [1, 2, 3];
  assert.equal(binarySearch(arr, 99, (x) => x).index, -1);
  assert.equal(linearSearch(arr, (x) => x === 99).index, -1);
});

// ---------------- Sorting ----------------

test('Sorting: quickSort sorts descending by score', () => {
  const arr = [{ s: 10 }, { s: 90 }, { s: 40 }];
  const { sorted } = quickSort(arr, (a, b) => b.s - a.s);
  assert.deepEqual(sorted.map((x) => x.s), [90, 40, 10]);
});

test('Sorting: mergeSort is stable', () => {
  const arr = [
    { name: 'a', s: 1 },
    { name: 'b', s: 1 },
    { name: 'c', s: 0 },
  ];
  const { sorted } = mergeSort(arr, (a, b) => b.s - a.s);
  assert.deepEqual(sorted.map((x) => x.name), ['a', 'b', 'c']);
});

test('Sorting: bubbleSort works (reference algorithm)', () => {
  const arr = [4, 2, 9, 1].map((s, i) => ({ s, i }));
  const { sorted } = bubbleSort(arr, (a, b) => a.s - b.s);
  assert.deepEqual(sorted.map((x) => x.s), [1, 2, 4, 9]);
});

// ---------------- EntityGraph ----------------

test('Graph: BFS finds jobs at 2 hops via skills', () => {
  const g = new EntityGraph();
  g.addNode({ key: 'candidate:u1', type: 'candidate', label: 'A' });
  g.addNode({ key: 'skill:python', type: 'skill', label: 'python' });
  g.addNode({ key: 'job:j1', type: 'job', label: 'Job1' });
  g.addEdge({ from: 'candidate:u1', to: 'skill:python', relation: 'has_skill', weight: 3 });
  g.addEdge({ from: 'job:j1', to: 'skill:python', relation: 'requires_skill', weight: 5 });
  const levels = g.bfs('candidate:u1', 2);
  const level2 = levels.get(2) ?? [];
  assert.ok(level2.includes('job:j1'));
});

test('Graph: candidateReach counts reachable jobs', () => {
  const g = new EntityGraph();
  g.addNode({ key: 'candidate:u1', type: 'candidate', label: 'A' });
  g.addNode({ key: 'skill:java', type: 'skill', label: 'java' });
  g.addNode({ key: 'job:j1', type: 'job', label: 'J1' });
  g.addNode({ key: 'job:j2', type: 'job', label: 'J2' });
  g.addEdge({ from: 'candidate:u1', to: 'skill:java', relation: 'has_skill', weight: 3 });
  g.addEdge({ from: 'job:j1', to: 'skill:java', relation: 'requires_skill', weight: 5 });
  g.addEdge({ from: 'job:j2', to: 'skill:java', relation: 'requires_skill', weight: 5 });
  assert.equal(g.candidateReach('candidate:u1', 2), 2);
});

// ---------------- MatchingEngine ----------------

test('Matching: perfect match scores 100', () => {
  const eng = new MatchingEngine();
  const cand = { id: 'c1', name: 'X', skills: ['Java', 'SQL', 'Spring Boot', 'Docker'], education: 'bachelors' as const, experienceYears: 3 };
  const job = { id: 'j1', title: 'Backend', requiredSkills: [
    { name: 'Java', weight: 5 as const }, { name: 'SQL', weight: 4 as const }, { name: 'Spring Boot', weight: 4 as const }, { name: 'Docker', weight: 3 as const }],
    preferredSkills: [], minEducation: 'bachelors' as const, minExperienceYears: 2 };
  const r = eng.scoreCandidateForJob(cand, job);
  assert.equal(r.score, 100);
});

test('Matching: half skill coverage ≈ 50% (spec example)', () => {
  // candidate has 2 of 4 required skills -> skill part = 0.5 -> score ≈ 50 + edu/exp
  const eng = new MatchingEngine();
  const cand = { id: 'c1', name: 'X', skills: ['Java', 'SQL'], education: 'bachelors' as const, experienceYears: 2 };
  const job = { id: 'j1', title: 'Backend', requiredSkills: [
    { name: 'Java', weight: 5 as const }, { name: 'SQL', weight: 5 as const }, { name: 'Spring Boot', weight: 5 as const }, { name: 'Docker', weight: 5 as const }],
    preferredSkills: [], minEducation: 'bachelors' as const, minExperienceYears: 2 };
  const r = eng.scoreCandidateForJob(cand, job);
  // 0.5*50 (half required skills) + 1*20 (no preferred) + 15 (edu) + 15 (exp) = 75
  assert.equal(r.score, 75);
  assert.equal(r.breakdown.requiredSkillMatch, 0.5);
  assert.deepEqual(r.missingRequired.sort(), ['Docker', 'Spring Boot']);
});

test('Matching: education gap reduces score', () => {
  const eng = new MatchingEngine();
  const cand = { id: 'c1', name: 'X', skills: ['Python'], education: 'bachelors' as const, experienceYears: 5 };
  const job = { id: 'j1', title: 'AI Eng', requiredSkills: [{ name: 'Python', weight: 5 as const }], preferredSkills: [], minEducation: 'masters' as const, minExperienceYears: 1 };
  const r = eng.scoreCandidateForJob(cand, job);
  assert.ok(r.score < 100);
  assert.ok(r.score >= 90);
});
