# 🎯 TalentMatch — Résumé–Job Matching & Talent Marketplace Engine

A **DSA semester project** built as a startup-grade product: candidates and recruiters are
connected through a matching engine whose every ranked list is produced by **hand-implemented
data structures and algorithms** — never by database sorting.

---

## ✨ Feature Highlights

| Role | Features |
|---|---|
| **Candidate** | Register/Login · Profile + skills (trie autocomplete) · Résumé upload metadata · Job search · Save jobs · Apply · Top-10 ranked recommendations · Skill-gap analysis · Reverse Resume roadmap |
| **Recruiter** | Register/Login · Company profile · Post / **edit / delete** weighted-skill jobs · Applicants + status pipeline · Candidate search + skill filter · Top-10 ranked candidates |

Plus: dark/light mode, responsive layout, match-score progress bars, skill-gap visualization,
live DSA benchmark page.

---

## 🧱 Tech Stack

- **Frontend**: Next.js 14 (App Router) · TypeScript · Tailwind CSS
- **Backend**: Node.js · Express · TypeScript · JWT + bcrypt auth
- **Database**: JSON file store (zero-setup default) · PostgreSQL schema included (`server/schema.sql`)
- **Algorithms**: all implemented manually in `server/src/dsa/`

---

## 🚀 Quick Start (local mode — no cloud needed)

```bash
# 1. Backend (port 4000)
cd talentmatch/server
npm install
cp .env.example .env   # defaults are fine for local mode
npm run seed           # 20 candidates, 6 companies, 20 jobs, 9 applications, 6 saved jobs
npm run dev            # or: npm run build && npm start

# 2. Frontend (port 3000) — new terminal
cd talentmatch/web
npm install
npm run dev            # dev mode; or: npm run build && npm start
```

Open **http://localhost:3000**. `GET /api/health` reports `authProvider: local`.

---

## 🟩 Supabase Setup (optional but recommended)

The backend runs in **dual mode**. With Supabase env vars set it upgrades automatically:

| Concern | Local mode (no Supabase) | Supabase mode |
|---|---|---|
| Auth | bcrypt + server JWT | **Supabase Auth** (GoTrue), tokens verified via JWKS/introspection |
| DB | `data/db.json` (JSON index) | Same JSON index **+ write-through to Postgres** |
| Seeding | `npm run seed` | `npm run seed` **pushes the same data to Supabase** |

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste **`server/supabase/migrations/0001_init.sql`** → Run.
   (Creates profiles, candidates, recruiters, skills, candidate_skills, jobs, job_skills,
   applications, saved_jobs, recommendations, roadmaps — with FKs, indexes and RLS.)
3. **Project Settings → API**: copy the project URL, the `anon` key and the `service_role` key.
4. Fill `talentmatch/server/.env`:

```bash
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # server-side only — never expose to the browser
```

5. Restart the API (`npm run dev`) — the health endpoint now reports `authProvider: supabase`.
6. Run `npm run seed` once to push demo data (optional: create the demo auth users first via
   Supabase Dashboard → Authentication → Add user, e.g. `karthik@example.com` / `password123`,
   then seeding mirrors their profile rows).

> Demo convenience: `signUp` auto-confirms the email when the service-role key is present
> (otherwise disable email confirmation in Supabase Auth settings for the demo).

### Demo accounts (password `password123`)

| Role | Email | Profile |
|---|---|---|
| Candidate | `karthik@example.com` | Python/ML — great for skill-gap + roadmap demo |
| Candidate | `aarav@example.com` | Full stack |
| Candidate | `ananya@example.com` | Data scientist (masters) |
| Recruiter | `hr@nimbussoft.com` | Nimbus Soft — 4 jobs |
| Recruiter | `talent@vertexanalytics.com` | Vertex Analytics — AI/ML jobs |

### Run tests

```bash
cd talentmatch/server
npm test              # 23 unit tests over all DSA modules + matcher
```

---

## 🌍 Deployment

**API** — any Node host (Render / Railway / Fly.io / VPS):

```bash
cd talentmatch/server
npm run build         # tsc → dist/
npm start             # node dist/index.js  (uses PORT env)
```

Set env vars on the host: `PORT`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Persistent disk optional in local mode (db.json).

**Web** — Vercel (`vercel deploy`) or any static-capable host:

```bash
cd talentmatch/web
npm run build && npm start     # or connect the repo to Vercel
```

For production, point the API proxy at your deployed API: edit `next.config.mjs` rewrites
`destination` from `http://localhost:4000` to `https://<your-api-host>`, or call the API
directly by setting `NEXT_PUBLIC_API_BASE` and updating `lib/api.ts` `BASE`.

---

## 📁 Project Structure

```
talentmatch/
├── server/
│   ├── src/
│   │   ├── dsa/                  ← THE DSA CORE (all hand-implemented)
│   │   │   ├── HashMap.ts        separate-chaining hash table + rehash
│   │   │   ├── Trie.ts           prefix tree, weighted autocomplete
│   │   │   ├── MaxHeap.ts        binary heap, top-k extraction
│   │   │   ├── Searching.ts      linear / binary / jump search
│   │   │   ├── Sorting.ts        quick / merge / bubble + metrics
│   │   │   └── EntityGraph.ts    adjacency graph, BFS / DFS
│   │   ├── services/
│   │   │   ├── MatchingEngine.ts        50/20/15/15 weighted score
│   │   │   ├── SkillGapAnalyzer.ts      gap report per job
│   │   │   ├── ReverseResumeGenerator.ts topo-sorted learning roadmap
│   │   │   ├── RecommendationService.ts heap top-k + sort orchestration
│   │   │   └── AutocompleteService.ts   3 tries + casing map
│   │   ├── routes/               auth / jobs / candidates / misc
│   │   ├── models/               types + JSON store (autosave)
│   │   ├── middleware/auth.ts    JWT guards
│   │   ├── seed.ts               demo data
│   │   └── index.ts              express app
│   ├── tests/dsa.test.ts         23 unit tests
│   ├── schema.sql                PostgreSQL schema (report + prod)
│   └── package.json
└── web/
    ├── app/                      pages (home, login, register, dashboards…)
    ├── components/               Nav, JobCard, SuggestInput, ui atoms
    ├── lib/api.ts                typed API client
    └── package.json
```

---

## 🔌 API Reference (summary)

| Method & Path | Auth | Purpose / DSA |
|---|---|---|
| `POST /api/auth/register` `POST /api/auth/login` | – | JWT auth, bcrypt |
| `GET /api/jobs?q=` | – | public list + substring filter |
| `GET /api/jobs/recommendations?limit=10` | candidate | **MaxHeap top-k** ranked jobs |
| `GET /api/jobs/ranked?q&sort` | candidate | **quickSort** full ranked list + metrics |
| `POST /api/jobs` | recruiter | post job (weighted skills) |
| `GET /api/jobs/:id` | – | job + **graph BFS similar jobs** |
| `POST /api/jobs/:id/apply` | candidate | application (score snapshot) |
| `POST /api/jobs/:id/save` · `DELETE …/save` | candidate | save / unsave job |
| `GET /api/jobs/saved` | candidate | bookmarked jobs |
| `PUT /api/jobs/:id` · `DELETE /api/jobs/:id` | recruiter | edit / delete own job |
| `GET /api/jobs/:id/applicants` · `PUT …/:appId` | recruiter | applicants + status pipeline |
| `GET /api/jobs/:id/candidates` | recruiter | ranked candidates + sort metrics |
| `GET /api/jobs/:id/skill-gap` | candidate | **skill gap report** |
| `GET /api/jobs/:id/reverse-resume` | candidate | **reverse resume roadmap** |
| `GET /api/candidates?q&skill&jobId&sort` | recruiter | candidate search/rank |
| `GET/PUT /api/candidates/me` | candidate | profile (rebuilds indexes) |
| `GET /api/autocomplete?kind=skill\|job\|company&q=` | – | **Trie** suggestions + timing |
| `GET /api/analytics/overview` | – | platform stats |
| `GET /api/analytics/dsa?n=2000` | – | **live benchmark** all structures |
| `GET /api/graph` | – | entity graph snapshot (viz) |
| `POST /api/auth/logout` | – | stateless sign-out (client discards session) |
| `GET /api/health` | – | `{ status, authProvider: supabase\|local }` |

---

## 🧮 The Matching Formula

```
Match Score (0–100) =
      Required Skills Match  × 50%     (weight-aware: w5 counts 5× w1)
    + Preferred Skills Match × 20%     (plain coverage ratio)
    + Education Match        × 15%     (one level short = 0.5)
    + Experience Match       × 15%     (ratio of required years, capped at 1)
```

Every API response includes the full breakdown; the UI renders four progress bars per card.

---

## 🗄 Database Modes

- **JSON (default)** — `server/data/db.json`, debounced autosave. Perfect for demos.
- **PostgreSQL** — apply `server/schema.sql`; see `docs/DSA-ARCHITECTURE.md` §7 for the
  mapping between tables and in-memory indexes.

## 📚 More Docs

- `docs/DSA-ARCHITECTURE.md` — DSA architecture diagram + complexity tables
- `docs/REPORT-STRUCTURE.md` — semester project report outline
# R-sum-Job-Matching-Talent-Marketplace-Engine
