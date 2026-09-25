# DSA Architecture — TalentMatch

## 1. System Overview Diagram

```
                        ┌──────────────────────────────────────────────┐
                        │                NEXT.JS WEB UI                │
                        │  Home · Login · Register · Dashboards        │
                        │  Job Search · Recommendations · Roadmap      │
                        │  Candidate Search · Analytics                │
                        └───────────────┬──────────────────────────────┘
                                        │ fetch /api (JWT)
                        ┌───────────────▼──────────────────────────────┐
                        │              EXPRESS API (4000)              │
                        │  auth · jobs · candidates · autocomplete     │
                        │  analytics · graph                           │
                        └───────────────┬──────────────────────────────┘
                                        │
        ┌───────────────────────────────▼────────────────────────────────┐
        │                    SERVICES (orchestration)                    │
        │  MatchingEngine · SkillGapAnalyzer · ReverseResumeGenerator    │
        │  RecommendationService · AutocompleteService                   │
        └───┬──────────┬──────────┬──────────┬──────────┬───────────────┘
            │          │          │          │          │
      ┌─────▼───┐ ┌────▼───┐ ┌────▼────┐ ┌───▼────┐ ┌───▼─────────┐
      │ HASHMAP │ │  TRIE  │ │ MAXHEAP │ │  GRAPH │ │ SORTS       │
      │ O(1)    │ │ O(L)   │ │ O(log n)│ │ O(V+E) │ │ O(n log n)  │
      │ indexes │ │ suggest│ │ top-k   │ │ BFS/DFS│ │ quick/merge │
      └─────────┘ └────────┘ └─────────┘ └────────┘ └─────────────┘
            │
      ┌─────▼──────────────────────────┐
      │ STORE: JSON db.json (autosave) │   PostgreSQL schema in schema.sql
      └────────────────────────────────┘
```

## 2. Data Flow — "Top 10 Jobs for Candidate"

```
candidate profile ──► HashMap<skill,true>          (O(S) build)
      │
      ▼
for each job J:                                        O(J·S)
  score = 0.50·reqMatch + 0.20·prefMatch
        + 0.15·edu + 0.15·exp
      │
      ▼
MaxHeap.push({score, jobId})                       (O(log n) each)
      │
      ▼
pop() × 10                                         (O(k log n))
      │
      ▼
JSON response {items[10], breakdowns}  ──►  UI progress bars
```

## 3. Complexity Table (all measured in `/api/analytics/dsa`)

| Structure / Algorithm | Operation | Average | Worst | Used For |
|---|---|---|---|---|
| HashMap (chaining) | put/get/delete | O(1) | O(n) | skill index, candidate index, job index |
| HashMap | rehash | O(n) amortized | – | dynamic growth |
| Trie | insert/search | O(L) | O(L) | autocomplete (3 kinds) |
| Trie | suggest top-k | O(P + k·L) | – | weighted suggestions |
| MaxHeap | push / pop | O(log n) | O(log n) | top-10 recommendations |
| MaxHeap | heapify build | O(n) | O(n) | batch scoring |
| Binary Search | find | O(log n) | O(log n) | sorted lookups |
| Linear Search | find | O(n) | O(n) | baseline comparison |
| Jump Search | find | O(√n) | O(√n) | middle-ground demo |
| QuickSort | sort | O(n log n) | O(n²) | ranked lists |
| MergeSort | sort | O(n log n) | O(n log n) | stable ordering |
| BubbleSort | sort | O(n²) | O(n²) | analytics comparison only |
| BFS / DFS | traverse | O(V + E) | – | similar jobs, related skills, reach |
| Topological Sort (Kahn) | order skills | O(V + E) | – | reverse resume roadmap |

## 4. Graph Schema

```
(candidate:c1)──has_skill──►(skill:python)◄──requires_skill(w5)──(job:j5)
                                   │                                   │
                     requires_skill│                                   │posted_by
                                   ▼                                   ▼
                              (job:j7) ────posted_by───► (recruiter:r2)
```

- **Nodes**: candidate, job, recruiter, skill (typed keys `type:id`)
- **Edges**: `has_skill` (proficiency weight), `requires_skill` (required w3–5 / preferred w1–2), `posted_by`
- **Features**: `similarJobs` (BFS ≤2 hops + shared-skill scoring), `relatedSkills`
  (skill→job→skill co-occurrence), `candidateReach` (reachable job count)

## 5. Reverse Resume Pipeline

```
SkillGapReport ──► expand missing skills with prerequisites (BFS on DAG)
      │
      ▼
Kahn topological sort  ──► learn order (prerequisites first)
      │
      ▼
difficulty + weeks ──► course catalog lookup ──► project templates
      │
      ▼
month bucketing (4.33 wks/month) ──► milestones timeline
```

## 6. Skill-Gap Example (spec case)

```
Candidate: Java, SQL                     Target job: Java, SQL, Spring Boot, Docker
→ requiredSkillMatch = 2/4 = 0.5         → 0.5 × 50 = 25  (weight-aware)
→ edu & exp match = 1.0                  → 20 + 15 + 15 = 50 → score 75*
Missing: Spring Boot, Docker
(*exact weights in seed give the spec's "current match 50%" skill component)
```

## 7. Tables ↔ Indexes Mapping

| SQL table | In-memory index |
|---|---|
| `skills` + `candidate_skills` | `HashMap<canonSkill, bool>` per scoring call |
| `jobs` / `candidates` | id-keyed lookups (store arrays) |
| `job_skills` | graph edges `requires_skill` |
| `recommendations` | heap top-k results (loggable) |
| `applications` | scored snapshot at apply time |
