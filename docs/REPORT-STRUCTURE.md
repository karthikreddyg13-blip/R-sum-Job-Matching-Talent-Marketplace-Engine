# Semester Project Report — Suggested Structure

> Fill each section referencing live code paths and screenshots from the running app.

## Title Page
Project title · team · course · guide · institution · date

## Certificate & Declaration
Standard institutional pages.

## Acknowledgements

## Abstract (½ page)
Problem, approach (DSA-powered matching), key results (complexity evidence, live benchmarks).

## Chapter 1 — Introduction
- 1.1 Motivation: generic job portals vs. ranked marketplaces
- 1.2 Problem statement
- 1.3 Objectives (map 1:1 to the DSA modules)
- 1.4 Scope & limitations

## Chapter 2 — Literature / Background
- 2.1 Matching systems (weighting approaches)
- 2.2 Data structures: hash tables, tries, heaps, graphs — textbook references (CLRS ch. 11/12/6/22)
- 2.3 Ranking & recommendation (content-based filtering)

## Chapter 3 — System Analysis
- 3.1 Existing systems & drawbacks
- 3.2 Proposed system
- 3.3 Feasibility (technical/economic/operational)
- 3.4 Requirements (functional: per role; non-functional: latency, O-complexity targets)

## Chapter 4 — Design
- 4.1 Architecture diagram → `docs/DSA-ARCHITECTURE.md` §1
- 4.2 DSA design decisions (why chaining; why trie over linear scan; why heap over full sort for top-k)
- 4.3 Matching formula derivation
- 4.4 Database design → `server/schema.sql` ERD
- 4.5 UI wireframes → screenshots from `/`, `/dashboard`, `/recommendations`, `/roadmap`, `/analytics`

## Chapter 5 — Implementation
- 5.1 Module map (file → DSA concept table)
- 5.2 Key algorithms with pseudocode: scoreCandidateForJob, trie.suggest, MaxHeap.topK, graph.bfs, topoSort
- 5.3 Screenshots of each feature (use demo accounts)
- 5.4 Unit tests → `server/tests/dsa.test.ts` (23 cases)

## Chapter 6 — Testing & Results
- 6.1 Test strategy (unit → API smoke → E2E)
- 6.2 Benchmark results table (screenshot `/analytics`): linear vs binary vs jump; quick vs merge vs bubble
- 6.3 Sample runs (skill-gap example: Java/SQL vs Spring Boot job)

## Chapter 7 — Conclusion & Future Scope
- Done: all seven DSA requirements
- Future: vector embeddings, persistent Postgres deployment, ATS integration, real-time notifications

## References
CLRS · Sedgewick · Next.js / Express docs.

## Appendices
A. Full source tree · B. API reference · C. schema.sql · D. Plagiarism report

---

## Viva Quick-Answers

| Question | Where to point |
|---|---|
| Why separate chaining? | `HashMap.ts` — simple, deletion-friendly vs open addressing |
| Collision handling demo? | `longestChain()` + analytics page bucket stats |
| Why is top-k a heap and not a sort? | O(n + k log n) vs O(n log n); heap also streams |
| Trie vs hash map for autocomplete? | Prefix queries impossible with flat maps; trie gives ranked prefixes |
| Is your matching explainable? | Every card renders the 4-component breakdown |
| Where is the graph used in product? | Job detail "Similar Jobs", related-skills chips, reach metric |
| Proof algorithms run, not DB? | `sortMetrics` returned by `/jobs/ranked` & `/candidates` |
