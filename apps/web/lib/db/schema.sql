-- Table to store user sync configurations
create table if not exists public.syncs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_folder_id text not null,
  drive_folder_name text not null,
  twelve_index_id text not null,
  twelve_index_name text not null,
  twelve_api_key text,
  created_at timestamptz not null default now()
);

alter table public.syncs enable row level security;

create policy "syncs_select_own" on public.syncs for select using (auth.uid() = user_id);
create policy "syncs_insert_own" on public.syncs for insert with check (auth.uid() = user_id);
create policy "syncs_delete_own" on public.syncs for delete using (auth.uid() = user_id);
-- Idempotent new column
alter table public.syncs add column if not exists twelve_api_key text;


-- Drive nodes tree storage (normalized, parent by drive id)
create table if not exists public.drive_nodes (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid not null references public.syncs(id) on delete cascade,
  drive_id text not null,
  name text not null,
  mime_type text,
  is_folder boolean not null default false,
  parent_drive_id text,
  -- optional metadata
  owner_name text,
  owner_email text,
  size bigint,
  modified_time timestamptz,
  created_time timestamptz,
  video_duration_ms bigint,
  video_width integer,
  video_height integer,
  updated_at timestamptz not null default now(),
  unique(sync_id, drive_id)
);

alter table public.drive_nodes enable row level security;

create policy "drive_nodes_select_own" on public.drive_nodes for select using (
  exists (select 1 from public.syncs s where s.id = drive_nodes.sync_id and s.user_id = auth.uid())
);
create policy "drive_nodes_insert_own" on public.drive_nodes for insert with check (
  exists (select 1 from public.syncs s where s.id = drive_nodes.sync_id and s.user_id = auth.uid())
);
create policy "drive_nodes_update_own" on public.drive_nodes for update using (
  exists (select 1 from public.syncs s where s.id = drive_nodes.sync_id and s.user_id = auth.uid())
);
create policy "drive_nodes_delete_own" on public.drive_nodes for delete using (
  exists (select 1 from public.syncs s where s.id = drive_nodes.sync_id and s.user_id = auth.uid())
);

-- Drive changes cursor per sync
create table if not exists public.drive_cursors (
  sync_id uuid primary key references public.syncs(id) on delete cascade,
  page_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.drive_cursors enable row level security;

create policy "drive_cursors_select_own" on public.drive_cursors for select using (
  exists (select 1 from public.syncs s where s.id = drive_cursors.sync_id and s.user_id = auth.uid())
);
create policy "drive_cursors_insert_own" on public.drive_cursors for insert with check (
  exists (select 1 from public.syncs s where s.id = drive_cursors.sync_id and s.user_id = auth.uid())
);
create policy "drive_cursors_update_own" on public.drive_cursors for update using (
  exists (select 1 from public.syncs s where s.id = drive_cursors.sync_id and s.user_id = auth.uid())
);

-- Idempotent column adds for upgrades
alter table public.drive_nodes add column if not exists owner_name text;
alter table public.drive_nodes add column if not exists owner_email text;
alter table public.drive_nodes add column if not exists size bigint;
alter table public.drive_nodes add column if not exists modified_time timestamptz;
alter table public.drive_nodes add column if not exists created_time timestamptz;
alter table public.drive_nodes add column if not exists video_duration_ms bigint;
alter table public.drive_nodes add column if not exists video_width integer;
alter table public.drive_nodes add column if not exists video_height integer;

