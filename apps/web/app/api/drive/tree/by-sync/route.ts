import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"

type DriveNode = {
  id: string
  name: string
  type: "folder" | "file"
  mimeType?: string
  ownerName?: string | null
  ownerEmail?: string | null
  size?: number | null
  modifiedAt?: string | null
  createdAt?: string | null
  videoDurationMs?: number | null
  videoWidth?: number | null
  videoHeight?: number | null
  status: "Synced" | "In Progress" | "Not Synced"
  subRows?: DriveNode[]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const syncId = searchParams.get("syncId")
  const driveId = searchParams.get("driveId")
  if (!syncId && !driveId) return NextResponse.json({ error: "Missing syncId or driveId" }, { status: 400 })

  const supa = await createRouteSupabase()

  // Verify current user has access to this sync via RLS (select should return 1 row)
  const baseQuery = supa
    .from("syncs")
    .select("id, drive_folder_id, drive_folder_name")
    .limit(1)
  const { data: syncRow, error: syncErr } = syncId
    ? await baseQuery.eq("id", syncId).maybeSingle()
    : await baseQuery.eq("drive_folder_id", driveId!).maybeSingle()
  if (syncErr || !syncRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch nodes for this sync
  const { data: rows, error } = await supa
    .from("drive_nodes")
    .select("drive_id,name,mime_type,is_folder,parent_drive_id,owner_name,owner_email,size,modified_time,created_time,video_duration_ms,video_width,video_height")
    .eq("sync_id", syncRow.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build tree
  const map = new Map<string, DriveNode>()
  const childrenByParent = new Map<string | null, DriveNode[]>()

  // Ensure root exists
  const rootDriveId = syncRow.drive_folder_id as string

  for (const r of rows || []) {
    const node: DriveNode = {
      id: r.drive_id,
      name: r.name,
      type: r.is_folder ? "folder" : "file",
      mimeType: r.mime_type || undefined,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      size: r.size,
      modifiedAt: r.modified_time,
      createdAt: r.created_time,
      videoDurationMs: r.video_duration_ms,
      videoWidth: r.video_width,
      videoHeight: r.video_height,
      status: "Synced",
      subRows: [],
    }
    map.set(node.id, node)
    const parentKey = (r.parent_drive_id as string | null) ?? null
    const list = childrenByParent.get(parentKey) || []
    list.push(node)
    childrenByParent.set(parentKey, list)
  }

  // Link children
  for (const [parentId, kids] of childrenByParent.entries()) {
    if (!parentId) continue
    const parent = map.get(parentId)
    if (parent) parent.subRows = kids
  }

  const root = map.get(rootDriveId) || {
    id: rootDriveId,
    name: syncRow.drive_folder_name,
    type: "folder",
    status: "Synced",
    subRows: childrenByParent.get(rootDriveId) || [],
  }

  return NextResponse.json({ ok: true, tree: root })
}


