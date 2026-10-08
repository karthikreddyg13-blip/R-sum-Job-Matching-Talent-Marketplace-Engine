# TalentMatch — Preview Run Doc

Stack: Next.js 14 web (port 3000) + Express/tsx API (port 4000) + JSON file DB.
Workspace for this thread is the **same directory** as the main checkout
(`/Users/karthikreddy/Desktop/reverse resume/talentmatch`), so there is nothing to copy
from another worktree. `server/.env` already exists (local mode: `DB_MODE=json`, no
Supabase vars needed). `server/data/db.json` (seeded) is committed/present — if it is ever
missing, regenerate it with `npm run seed` (next section).

## 1. Reproduce the artifacts (fresh checkout)

> **Update:** the repo is now an npm **workspaces** monorepo (root `package.json` +
> `scripts/dev.js`), and `web` was upgraded to **Next 16.3.8 / React 19**. Install once
> from the ROOT — there is no separate `web/node_modules`.

```bash
npm install                     # root: hoists server + web deps (workspaces)
cd server
# cp .env.example .env          # only if server/.env is missing (PORT=4000, DB_MODE=json)
npm run seed                    # ONLY if server/data/db.json is missing
```

## 2. Run the servers

**API (port 4000)** — `GET /api/health` must answer `{"status":"ok","authProvider":"local"}`.
If nothing is listening on 4000:

```bash
cd server && npm run dev        # foreground, or: npm run build && npm start
```

**Web (port 3001 as of 2026-10-05)** — `web/package.json`'s dev script is now plain
`next dev` (default :3000), **but :3000 is occupied by another project's dev server**
(`/Users/karthikreddy/Desktop/development/student-os`, started 2026-10-01 — do NOT kill
it). Pass an explicit port. Detached, logging to the preview log:

```bash
LOG='/Users/karthikreddy/Desktop/reverse resume/talentmatch/.freebuff/preview-bc8d0cd0-4679-47cd-af56-9c509f9fe9fb.log'
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
cd '/Users/karthikreddy/Desktop/reverse resume/talentmatch/web'
{ nohup perl -MPOSIX -e 'setsid() or die "setsid: $!"; exec(@ARGV)' npm run dev -- -p 3001 \
    > "$LOG" 2>&1 < /dev/null & echo "pid=$!"; disown; }
```

If port 3000 frees up later, `npm run dev` (no `-- -p`) uses the default 3000 again.

Verify: `ps -p <pid>` stays alive, then `curl -o /dev/null -w '%{http_code}' http://localhost:3001`
→ 200 (and `curl http://localhost:3001/api/health` must return JSON from the API — the
rewrite in `next.config.mjs` proxies `/api/*` → :4000). Register `http://localhost:3001`
with the pid of the `npm run dev` process.

### Hard-won notes (do not regress)

- **Plain `nohup ... &` from the tool runner gets reaped** ~seconds after the command exits
  (Next prints "Ready" then dies). Detaching into a **new session** with
  `perl -MPOSIX -e 'setsid(); exec @ARGV'` survives; verified over multiple checks.
- **launchd (`launchctl submit`) cannot run this server**: processes spawned by launchd get
  no Desktop TCC access, and node fails with `EPERM: process.cwd failed (uv_cwd)` on this
  Desktop path. Do not use launchd here.
- Homebrew node/npm live in `/opt/homebrew/bin` — PATH must include it for detached shells.
- `web/next.config.mjs` proxies `/api/*` → `http://localhost:4000/api/*`; keep the API on
  4000 or update the rewrite.
