import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"

export async function GET() {
  const supa = await createRouteSupabase()
  const { data } = await supa.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  // Load user syncs
  const { data: syncs, error: syncErr } = await supa
    .from("syncs")
    .select("id, drive_folder_id, drive_folder_name, twelve_index_id, twelve_index_name, twelve_api_key, created_at")
    .order("created_at", { ascending: false })
  if (syncErr) return NextResponse.json({ ok: false, error: syncErr.message }, { status: 500 })

  // For each sync, count nodes and videos
  const items: any[] = []
  for (const s of syncs || []) {
    const [{ data: cntAll }, { data: cntFolders }, { data: cntVideos }, { data: cursor }] = await Promise.all([
      supa.from("drive_nodes").select("drive_id", { count: "exact", head: true }).eq("sync_id", s.id),
      supa.from("drive_nodes").select("drive_id", { count: "exact", head: true }).eq("sync_id", s.id).eq("is_folder", true),
      supa.from("drive_nodes").select("drive_id", { count: "exact", head: true }).eq("sync_id", s.id).like("mime_type", "video/%"),
      supa.from("drive_cursors").select("updated_at,page_token").eq("sync_id", s.id).maybeSingle(),
    ])
    items.push({
      id: s.id,
      name: s.drive_folder_name,
      driveId: s.drive_folder_id,
      createdAt: s.created_at,
      counts: {
        total: (cntAll as any)?.count ?? 0,
        folders: (cntFolders as any)?.count ?? 0,
        files: Math.max(((cntAll as any)?.count ?? 0) - ((cntFolders as any)?.count ?? 0), 0),
        videos: (cntVideos as any)?.count ?? 0,
      },
      lastUpdatedAt: cursor?.updated_at ?? null,
      hasCursor: Boolean(cursor?.page_token),
      twelveApiKey: s.twelve_api_key ?? null,
      twelveIndexName: s.twelve_index_name,
    })
  }

  return NextResponse.json({ ok: true, items })
}


