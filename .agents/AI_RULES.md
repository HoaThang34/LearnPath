# AI_RULES — Safe change workflow

> Mandatory rules for every AI/agent that edits LearnPath code or data.
> Goal: change every required layer, avoid collateral damage, and leave verifiable evidence.

## 0. Classify the change (L0–L3)

Classify **before** editing. Higher levels need more evidence and user approval.

| Level | Examples | Required |
|---|---|---|
| **L0 — Docs** | README, `.agents/*`, comments | Read relevant code; no build required; update dates/facts |
| **L1 — UI only** | Text, colour, spacing, component, responsive layout | Read page + API client; `npm run build`; manual flow check |
| **L2 — Behaviour/API** | New filter, endpoint, query change, display logic | Impact map; backend + client + UI; API smoke; regression |
| **L3 — Destructive/Contract** | Schema, DB import/reset, school mapping, table deletion, response contract, new dependency, auth/session/cookie behavior, auth DB schema | **Ask the user first**; backup; rollback plan; data validation; security test |

**Golden rule**: if you are unsure whether a task is L2 or L3, treat it as **L3** and ask.

## 1. Non-negotiable rules

1. Do not commit, push, or open a PR unless explicitly asked.
2. Never run `npm run db:init` on the real admission DB, delete/overwrite `learnpath.db` or `auth.db`, or edit a `.db` file by hand without explicit approval and a backup.
3. Do not change API responses, query parameters, schema, data semantics, auth/session behaviour, rate limits, or cookie flags without agreement.
4. Do not leave empty `catch` blocks, swallowed errors, or fake fallback data.
5. Keep Vietnamese for UI text, business labels, and user-facing messages. Use English for code, identifiers, comments in agent docs, and commits.
6. Do not hardcode DB values in the UI; fetch from the API. Existing marketing copy is the only exception.
7. Stay inside the requested scope. Put unrelated findings in `KNOWN_ISSUES.md`.
8. Every completion report must include files changed, commands run, actual output, and remaining risks.
9. Stop background servers you started.
10. If the baseline is already failing and the cause is outside the task, report it instead of piling on changes.

## 2. The 8-step workflow

### Step 1 — Read the map

- `AGENTS.md` → `.agents/README.md` → `PROJECT_CONTEXT.md` → `ARCHITECTURE.md`.
- Read the actual page/route/import files for the task.
- For bugs, read `KNOWN_ISSUES.md`; for feature work, read `PLAYBOOKS.md`.

### Step 2 — Verify the baseline

```bash
git status --short
git log -1 --oneline
```

Run the minimum checks relevant to the area:

```bash
cd frontend && npm run build
cd backend && npm run dev
```

Do not “fix” an unrelated baseline failure silently.

### Step 3 — Map the impact

Write down:

- DB/import impact (does the data or schema change?).
- API impact (new/removed params, response shape, status codes).
- API client impact (`frontend/src/lib/api.js`).
- UI impact (state, loading, error, empty, pagination).
- Documentation impact.
- Rollback path.

If any layer is missing, the change is incomplete.

### Step 4 — Implement at every layer

Typical order:

1. `backend/src/database/init.js` (only if schema/import is in scope).
2. `backend/src/routes/*.js` and shared helpers.
3. `frontend/src/lib/api.js`.
4. `frontend/src/pages/*.jsx` / components.
5. `.agents/*` and `README.md` if behaviour or facts changed.

Keep the existing style. Do not rename unrelated symbols.

### Step 5 — Verify the backend

```powershell
Invoke-RestMethod http://localhost:3001/api/health
Invoke-RestMethod http://localhost:3001/api/de-an?limit=2
Invoke-RestMethod http://localhost:3001/api/diem-chuan/stats
Invoke-RestMethod http://localhost:3001/api/khoi-thi/A00
```

Test error paths explicitly (invalid `limit`, `offset`, missing detail). Check the actual JSON, not just the HTTP status.

### Step 6 — Verify the frontend

```bash
cd frontend
npm run build
```

Then check the affected flow manually if possible: loading, success, empty, error, retry, pagination, browser back/forward, and rapid switching. There is no **committed** browser automation; a temporary headless Chrome E2E may be used, but state any flow you did not actually check.

### Step 7 — Verify data (read-only)

```bash
node .agents/scripts/inspect-db.js
```

For import changes, use an isolated database:

```powershell
$env:LEARNPATH_DB_PATH = Join-Path $env:TEMP "learnpath-test.db"
node backend/src/database/init.js
node .agents/scripts/inspect-db.js --db $env:LEARNPATH_DB_PATH
Remove-Item Env:\LEARNPATH_DB_PATH
```

Never point `LEARNPATH_DB_PATH` at the real DB during experiments.

For auth changes, use a separate temporary auth DB and never write test accounts to the real one:

```powershell
$env:LEARNPATH_AUTH_DB_PATH = Join-Path $env:TEMP "learnpath-auth-test.db"
```

It must differ from `LEARNPATH_DB_PATH`; the server rejects the same file. Confirm the admission DB hash is unchanged before and after.

### Step 8 — Report and hand off

Include:

- What changed and why.
- Exact files.
- Commands and observed output.
- Data changes and whether a rebuild is still required.
- Remaining issues/risks.
- Confirmation that no commit/push occurred (unless requested).

## 3. Subagent protocol

Use a subagent for independent research or a well-bounded implementation slice. Do not use one to bypass the rules.

When spawning:

- Give the full task context, constraints, and target files.
- State whether the subagent may edit files or only investigate.
- Require a final report with commands and evidence.
- Do not let two subagents edit the same files concurrently.
- Review the subagent diff yourself before accepting it.

Good subagent tasks:

- “Find every place that consumes `/api/de-an?limit`.”
- “Audit the CSV importer for quoted-field bugs; do not edit.”
- “Add a single error state to this page and run the build.”

Bad subagent tasks:

- “Fix all data issues.”
- “Rebuild the DB.”
- “Refactor the backend.”

## 4. Anti-patterns (do not repeat)

| Anti-pattern | Why it is wrong |
|---|---|
| `db.js` creates an old schema | It silently diverges from `init.js`; the app starts with missing columns |
| `if (!scores[x])` for numeric data | `0` is a valid score but is treated as absent |
| `catch (e) {}` | Hides network/import failures and leaves the UI blank |
| `total = results.length` | Returns the page size instead of the real count |
| `parseInt(limit)` without validation | `NaN`/negative values reach SQLite |
| `COUNT(d.id)` as “major count” | Counts rows, not distinct majors |
| `Button asChild` without Slot support | The child link is not rendered as expected |
| Comparing a 3-subject total with an all-subject total | Produces a meaningless rank |
| Matching block files by filename only | Misses multi-code headers and skips valid files |
| Rebuilding the real DB “to test” | Destructive; use `LEARNPATH_DB_PATH` |
| Storing raw passwords/session tokens | Any DB/log leak becomes account takeover; store scrypt hashes and SHA-256 token hashes only |
| Putting the session token in localStorage | XSS can read it; use the HttpOnly `lp_session` cookie |
| `cors()` with `*` plus credentials | Browsers reject it and it defeats origin control; use the explicit allowlist |
| Treating a client-side guard as auth | API routes must enforce `requireAuth` themselves |
| Writing test users into the real `auth.db` | Pollutes real accounts; use `LEARNPATH_AUTH_DB_PATH` |

## 5. Handoff checklist

- [ ] Scope and classification (L0–L3) recorded.
- [ ] Baseline checked.
- [ ] Every affected layer changed.
- [ ] Frontend build passes.
- [ ] API smoke and error paths checked.
- [ ] Auth/session checked (401, cookie flags, no token storage, temp auth DB) when touched.
- [ ] Data check run read-only (or isolated DB).
- [ ] Admission DB hash unchanged; default auth DB not polluted.
- [ ] Docs/facts updated.
- [ ] Known issues updated.
- [ ] Background server stopped.
- [ ] No commit/push unless requested.
- [ ] Final report contains evidence and remaining risks.

## 6. When to stop and ask

Stop immediately and ask the user when:

- The change requires a real DB rebuild, schema change, or data deletion.
- The request depends on a business rule that is not specified (ranking combination, score scale, year semantics).
- The fix would change an API contract used by another consumer.
- Two sources of truth disagree and the correct one is not clear.
- A test reveals a failure outside the requested scope.
