# TwelveLabs × Google Drive Sync

Next.js 15 app (App Router, React 19) that connects a Google Drive folder to a Twelve Labs index, stores the Drive tree in Supabase, and keeps it up to date via the Google Drive Changes API. UI is built with a shared shadcn-style design system.

## Project structure

```
gdrive-twelvelabs-sync/
├─ apps/
│  └─ web/                 — Next.js app (App Router)
│     ├─ app/              — routes, pages, API routes
│     ├─ components/       — app-specific components
│     ├─ hooks/
│     ├─ lib/              — supabase, services, db schema
│     ├─ next.config.mjs
│     └─ package.json
├─ packages/
│  ├─ ui/                  — shared UI (shadcn-style)
│  ├─ eslint-config/
│  └─ typescript-config/
├─ package.json            — root scripts (turbo)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md
```

## Scripts

- Root:
  - `pnpm dev` — start dev via Turbo (runs `apps/web`)
  - `pnpm build` — build all packages/apps
  - `pnpm lint` — lint
  - `pnpm format` — prettier
- `apps/web`:
  - `pnpm dev` — `next dev --turbopack`
  - `pnpm build` — `next build`; `pnpm start` — `next start`
  - `pnpm lint`, `pnpm lint:fix`, `pnpm typecheck`

## Supabase schema (minimal delta)

Run in Supabase SQL Editor:

```sql
-- New column for Twelve Labs API key
alter table if exists public.syncs
  add column if not exists twelve_api_key text;

-- New metadata fields on drive_nodes
alter table if exists public.drive_nodes
  add column if not exists created_time timestamptz,
  add column if not exists video_duration_ms bigint,
  add column if not exists video_width integer,
  add column if not exists video_height integer;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
```

Full schema lives at `apps/web/lib/db/schema.sql` (tables: `syncs`, `drive_nodes`, `drive_cursors` with RLS policies).

## Environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Google OAuth scope: `https://www.googleapis.com/auth/drive.readonly`.

## How it works

1) Add Folder (Library → Add Folder)
- Verify Google Drive link: `POST /api/drive/verify`
- Validate Twelve Labs API key and list indexes: `POST /api/twelvelabs/indexes`
- Save sync: `POST /api/syncs` (stores API key, index info)
- Start initial sync: `POST /api/drive/sync/start`
  - capture `startPageToken`
  - crawl Drive tree and store `drive_nodes`
  - save cursor in `drive_cursors`
- Poll deltas: `POST /api/drive/sync/poll` (immediately after start) to close the gap

2) Library UI
- Overview block: per-folder status (Drive, Twelve Labs), counts (folders/files/videos), index info, masked API key (show/hide), link to Drive.
- Tree:
  - Select a folder to render its stored hierarchy
  - “All” shows all roots (collapsed by default) and loads each tree once
  - Tooltips (shadcn Tooltip) with MIME, Owner, Size, Created, Duration/Dimensions; quick link to open in Drive

## API endpoints

- `POST /api/drive/verify` — { url } → { ok, folderId, name }
- `POST /api/twelvelabs/indexes` — { apiKey, filters? } → indexes
- `POST /api/syncs` — create sync (saves Twelve Labs key)
- `GET  /api/syncs` — list user syncs
- `GET  /api/syncs/summary` — metrics/status per sync
- `POST /api/drive/sync/start` — initial crawl; stores nodes + cursor
- `POST /api/drive/sync/poll` — apply deltas (by `syncId` or `driveId`)
- `GET  /api/drive/tree/by-sync?driveId=...|syncId=...` — stored tree for rendering

Notes:
- Server routes await an async `createRouteSupabase()` to satisfy Next.js cookies handling.
- Twelve Labs indexes support filters (index_name, model_options, model_family, created_at, updated_at).

## Performance & quotas

- Drive API quotas (per-user QPS, per-project rate limits) apply — check Google Cloud Console → APIs & Services → Quotas.
- Initial crawl uses `pageSize=1000` and partial `fields`. For huge trees consider batching parents and controlled parallelism.
- Updates use Changes API with a rolling `page_token`.

## Security

- RLS policies scope data to the owning user (`auth.uid()`).
- Twelve Labs API key is optional and masked in the UI.

## Dev checklist

1) `pnpm install`
2) Apply SQL (above)
3) Create `.env.local`
4) `pnpm dev`
5) `/library` → Sign in Google → Add Folder → Select Twelve Labs index

## Troubleshooting

- Next: “cookies() should be awaited” — ensure server routes await `createRouteSupabase()`.
- 500 on summary/syncs — apply SQL and reload schema with `notify pgrst, 'reload schema'`.
- Drive verify ok:false — sign in with Google and confirm folder access.
