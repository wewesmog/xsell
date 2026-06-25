# Xsell — reference

Base URL (local): `http://localhost:8000`  
Frontend API base: `NEXT_PUBLIC_XSELL_API_BASE_URL` (default `http://localhost:8000`)

---

## E2E flow

```
Upload file → Clean → Approve list (SQLite)
    → Schedule wizard (8 steps) → Save broadcast (config_json)
    → POST /api/broadcasts/{id}/generate
    → Excel workbooks under backend/data/outputs/{broadcast_id}/
```

| Step | Action | API / script |
|------|--------|----------------|
| 0 | Apply DB migrations | `python scripts/apply_migration.py` |
| 1 | Upload + map columns | `POST /api/lists/preview`, `POST /api/lists/upload` |
| 2 | Dedupe / validate MSISDN | `POST /api/lists/{id}/clean` |
| 3 | Approve for campaigns | `POST /api/lists/{id}/approve` |
| 4 | Configure schedule (UI or JSON) | `POST /api/broadcasts` |
| 5 | Generate workbooks | `POST /api/broadcasts/{id}/generate` |

**CLI (full pipeline, no UI):**

```bash
cd backend
python scripts/e2e_list_to_excel.py --apply-migrations --file path/to/leads.csv --msisdn-col MOBILE_NO --pool-size 50
```

Flags: `--staff-no`, `--exclusions` (Oracle), `--pool-size`, `--apply-migrations`

**Regenerate existing broadcast:**

```bash
python scripts/generate_broadcast.py --broadcast-id <uuid>
```

**Health:**

```bash
GET /health
```

### Generate pipeline (backend)

On `POST /api/broadcasts/{id}/generate`, `broadcast_generate.py`:

1. Loads approved rows from `list_rows` via `leads.fileName` (list UUID).
2. Applies Oracle + list exclusions when `leads.exclusionsEnabled`.
3. Ranks by `ranking.criteria` (weights must total 100%).
4. Dedupes pool by `msisdn_clean` before assign.
5. Assigns by `assignment.mode` (`random` | `fair` | `fair_even`).
6. **Safety purge** — duplicate phones after assign are dropped (keep first).
7. **Top-up** — short agent-day groups are back-filled from the ranked reserve pool.
8. Writes per-agent/day Excel + `MASTER_ASSIGNMENT_LOG.xlsx`. Workbook **Product Name** column uses the parent **campaign name** (`campaign.campaignName`).

Fair modes require `assignment.fairnessColumn` to exist in the lead list; generate fails loudly if missing (no silent fallback to random).

---

## Broadcast `config_json` (wizard draft)

Stored on `broadcasts.config_json` and mirrored in the frontend Zod schema (`frontend/lib/schedule/schema.ts`).

| Path | Type | Notes |
|------|------|--------|
| `campaign.campaignId` | string | Parent campaign UUID |
| `campaign.broadcastId` | string | Empty for new; set after save |
| `campaign.broadcastName` | string | Required |
| `leads.fileName` | string | **Approved list UUID** (`lists.list_id`) |
| `leads.listName` | string | Display name (optional; hydrated from API) |
| `leads.msisdnColumn` | string | Source phone column header |
| `leads.poolSize` | number | Leads available after exclusions |
| `leads.exclusionsEnabled` | boolean | Oracle + extra lists |
| `leads.exclusionsLookbackDays` | int | 1–365 |
| `leads.exclusionProductNames` | string[] | Optional `Product Name` filter |
| `leads.exclusionLists` | `{listId, listName, rowCount}[]` | Other approved lists to exclude |
| `ranking.criteria` | `{column, direction, weight}[]` | Weights sum to 100 |
| `ranking.agentVisibleColumns` | string[] | Display labels for workbooks |
| `assignment.mode` | enum | `random` \| `fair` \| `fair_even` |
| `assignment.fairnessColumn` | string | Required for fair modes; no default |
| `agents.selectedStaffNos` | string[] | Staff numbers |
| `volume.leadsPerAgentPerDay` | int | 1–500 |
| `volume.internalName` | string | Optional notes (not written to Excel) |
| `volume.customFields` | array | Extra workbook columns |
| `schedule.mode` | enum | `range` \| `specific` |
| `schedule.startDate` / `numDays` | | Range mode |
| `schedule.specificDates` | string[] | ISO dates |

`lead_list_id` and `pool_size` on the `broadcasts` row are derived from `config_json` on save.

### Schedule wizard behaviour

- **No auto-save** of draft to `localStorage` (fresh wizard on new schedule; edit via `?broadcastId=`).
- **Assign step** copy and preview are driven by form values (mode, fairness column, quota, phone column, agents, dates).
- **Review / generate** validates all steps including roster absences (`validateForGenerate(draft, roster)`).
- Capacity warnings use **eligible agent-day slots** (active + not absent), not raw agent count.

---

## SQLite tables (`backend/xsell.db`)

| Table | Purpose |
|-------|---------|
| `schema_migrations` | Applied migration filenames |
| `lists` | Ingested list metadata (`processing` / `ready` / `archived`) |
| `list_rows` | Normalized rows per list (`msisdn_clean`, `others_json`, `decision`) |
| `campaigns` | Parent program container |
| `broadcasts` | One schedule run; `config_json`, `lead_list_id`, `pool_size`, `generated_at`, `output_dir`, `workbook_schema_json` |
| `agents` | Outbound staff master (`staff_no`, `active`) |
| `roster_absences` | Per-day absences (`staff_no`, `absent_date`) |
| `broadcast_responses` | Per-lead response rows (JSON); seeded on generate |

**Staged uploads (disk, not DB):** `backend/data/uploads/{list_id}.*`, `.mapping.json`, `.meta.json`

**Generated output (disk):** `backend/data/outputs/{broadcast_id}/{campaign}_{broadcast}/`

---

## Oracle (external)

| Source | Purpose |
|--------|---------|
| `CONVERSIONS_FINAL` | Exclusion MSISDNs (lookback + optional `"Product Name"` filter) |
| Env vars | `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE` |
| Module | `backend/app/shared_services/oracle_db.py` |

Preview uses short cache; **generate always queries fresh**.

---

## API endpoints

Prefix: `/api` unless noted.

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Status, `db_path`, `oracle_configured` |

### Lists (`list_ingestion.py`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/lists/preview` | Parse upload; return headers + sample rows |
| POST | `/lists/upload` | Stage file + mapping |
| POST | `/lists/{id}/clean` | Dedupe, normalize MSISDN, write `list_rows` |
| POST | `/lists/{id}/approve` | Set status `ready` |
| POST | `/lists/{id}/cancel` | Discard staged / unapproved upload |
| GET | `/lists` | List summaries (`search`, `sort`, `limit`) |
| GET | `/lists/{id}/columns` | Headers, numeric cols, preview rows |
| GET | `/lists/{id}/status` | List detail + counts |
| POST | `/lists/{id}/archive` | Soft-disable list |

### Exclusions (`exclusions.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/exclusions/campaigns?lookback_days=` | Distinct `Product Name` from Oracle |
| POST | `/exclusions/preview` | Overlap count vs lead list (wizard estimate) |

### Campaigns & broadcasts (`campaigns.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List campaigns |
| POST | `/campaigns` | Create campaign |
| GET | `/campaigns/{id}` | Campaign detail |
| PATCH | `/campaigns/{id}` | Update campaign |
| DELETE | `/campaigns/{id}` | Delete campaign |
| GET | `/broadcasts` | List broadcasts (`campaign_id` filter) |
| POST | `/broadcasts` | Create broadcast + `config_json` |
| GET | `/broadcasts/{id}` | Broadcast detail |
| PATCH | `/broadcasts/{id}` | Update broadcast |
| DELETE | `/broadcasts/{id}` | Delete broadcast |
| POST | `/broadcasts/{id}/generate` | Rank, assign, write Excel |
| POST | `/broadcasts/{id}/duplicate` | Copy broadcast config |
| GET | `/broadcasts/{id}/workbook-schema` | Column schema snapshot |
| GET | `/broadcasts/{id}/responses` | List response rows |
| POST | `/broadcasts/{id}/responses` | Upsert response rows |

### Agents & roster (`agents.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roster` | Active agents + `absent_dates` (schedule UI) |
| GET | `/agents` | List agents |
| POST | `/agents` | Create agent |
| GET | `/agents/{staff_no}` | Agent detail |
| PATCH | `/agents/{staff_no}` | Update agent |
| DELETE | `/agents/{staff_no}` | Delete agent |
| GET | `/roster/absences` | List absences |
| POST | `/roster/absences` | Add absence |
| DELETE | `/roster/absences/{id}` | Remove absence |

---

## Frontend routes (`app/`)

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing / redirect |
| `/dashboard` | `app/dashboard/page.tsx` | Dashboard home |
| `/dashboard/campaign/lists` | `app/dashboard/campaign/lists/page.tsx` | List ingestion |
| `/dashboard/campaign/campaigns` | `app/dashboard/campaign/campaigns/page.tsx` | Broadcast list; generate / duplicate |
| `/dashboard/campaign/schedule` | `app/dashboard/campaign/schedule/page.tsx` | 8-step schedule wizard |
| `/dashboard/campaign/reports` | `app/dashboard/campaign/reports/page.tsx` | Reports placeholder |
| `/dashboard/admin/agents` | `app/dashboard/admin/agents/page.tsx` | Agent CRUD |
| `/dashboard/admin/roster` | `app/dashboard/admin/roster/page.tsx` | Absence management |
| `/dashboard/admin/campaign-settings` | `app/dashboard/admin/campaign-settings/page.tsx` | Campaign CRUD |

---

## Frontend TSX — pages & feature components

### Lists

| File | Description |
|------|-------------|
| `components/lists/list-ingestion-page.tsx` | Upload, map columns, clean, approve |
| `components/lists/list-picker.tsx` | Searchable list selector (schedule + exclusions) |

### Schedule wizard

| File | Description |
|------|-------------|
| `components/schedule/schedule-campaign-wizard.tsx` | Wizard shell, step navigation |
| `components/schedule/steps/campaign-step.tsx` | Step 1: campaign + broadcast name |
| `components/schedule/steps/leads-step.tsx` | Step 2: list, MSISDN map, Oracle exclusions |
| `components/schedule/steps/rank-step.tsx` | Step 3: ranking criteria + visible columns |
| `components/schedule/steps/assign-step.tsx` | Step 4: assignment mode + fairness column |
| `lib/schedule/sharing.ts` | Assignment copy helpers + distribution preview |
| `components/schedule/steps/agents-step.tsx` | Step 5: agent selection |
| `components/schedule/steps/volume-step.tsx` | Step 6: leads/day, product, custom workbook fields |
| `components/schedule/steps/schedule-dates-step.tsx` | Step 7: date range or specific dates |
| `components/schedule/steps/review-step.tsx` | Step 8: summary, save, generate |
| `components/schedule/column-rename-editor.tsx` | Column label / export toggles |
| `components/schedule/custom-workbook-fields.tsx` | Custom Excel columns editor |
| `components/schedule/ranking-preview.tsx` | Top-N ranking preview |
| `components/schedule/sharing-preview.tsx` | Assignment distribution preview |
| `components/schedule/agent-roster-context.tsx` | Loads `GET /api/roster` for wizard |
| `components/schedule/schedule-stepper.tsx` | Step indicator |
| `components/schedule/schedule-summary.tsx` | Compact draft summary |

### Campaign admin UI

| File | Description |
|------|-------------|
| `app/dashboard/campaign/campaigns/page.tsx` | Broadcast table, generate, duplicate |
| `app/dashboard/admin/campaign-settings/page.tsx` | Campaign create/edit |

### Layout / shell

| File | Description |
|------|-------------|
| `app/dashboard/layout.tsx` | Dashboard layout: KCB blue chrome, rounded content panel |
| `components/app-sidebar.tsx` | Nav: Lists, Campaigns, Schedule, Admin |
| `components/nav-main.tsx` | Sidebar menu items |

---

## Frontend API clients (`lib/`)

| File | Backend routes used |
|------|---------------------|
| `lib/lists/api.ts` | `/api/lists/*` |
| `lib/campaigns/api.ts` | `/api/campaigns`, `/api/broadcasts/*` |
| `lib/agents/api.ts` | `/api/agents`, `/api/roster/*` |
| `lib/schedule/exclusions-api.ts` | `/api/exclusions/*` |

---

## Backend layout (reference)

| Path | Description |
|------|-------------|
| `app/main.py` | FastAPI app, routers, CORS |
| `app/api/*.py` | HTTP routers |
| `app/xsell_helpers/canon_main.py` | List ingest / clean / approve |
| `app/xsell_helpers/file_ingest.py` | CSV, TSV, TXT, DAT, XLSX, XLS reader |
| `app/xsell_helpers/broadcast_generate.py` | Rank, assign, Excel output |
| `app/xsell_helpers/oracle_exclusions.py` | Oracle exclusion query + preview |
| `app/shared_services/oracle_db.py` | Central Oracle connection |
| `migrations/*.sql` | Schema (run via `scripts/apply_migration.py`) |
| `scripts/e2e_list_to_excel.py` | End-to-end CLI test |
| `scripts/generate_broadcast.py` | Generate-only CLI |

---

## Supported upload formats

`.csv`, `.tsv`, `.txt`, `.dat`, `.xlsx`, `.xls`, extensionless (delimiter sniff). Excel: first sheet only.

---

## Generate output

Per agent / day: `{AgentName}_Details_{DD-Mon-YYYY}.xlsx`  
Run log: `MASTER_ASSIGNMENT_LOG.xlsx`  
Path: `backend/data/outputs/{broadcast_id}/{campaign}_{broadcast}/`

**Mandatory workbook columns:** Date, Lead ID, Product Name, Agent Name, Dial Attempt #, lead columns, custom fields, Connection, Disposition, Outcome comment, Follow-up Action, Follow-up Date.
