import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"
import { createAdminSupabase } from "@/lib/supabase/server"

// Starts an initial tree sync for a Drive folder and stores nodes + a changes cursor
export async function POST(req: Request) {
  const { syncId, folderId } = await req.json()
  if (!syncId || !folderId) return NextResponse.json({ error: "Missing syncId or folderId" }, { status: 400 })

  const supa = await createRouteSupabase()
  const { data } = await supa.auth.getUser()
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminSupabase()
  // Verify the sync belongs to the user
  const { data: syncRow, error: syncErr } = await admin
    .from("syncs")
    .select("id, user_id, drive_folder_id")
    .eq("id", syncId)
    .single()
  if (syncErr || !syncRow) return NextResponse.json({ error: "Sync not found" }, { status: 404 })
  if (syncRow.user_id !== data.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Get Google token
  // Prefer provider_token from session
  const sessionRes = await supa.auth.getSession()
  let providerToken: string | undefined = (sessionRes.data.session as any)?.provider_token
  if (!providerToken) {
    const google = (data.user as any).identities?.find((i: any) => i.provider === "google")
    providerToken = (google as any)?.identity_data?.access_token
  }
  if (!providerToken) return NextResponse.json({ error: "Google not linked" }, { status: 403 })

  // Capture startPageToken BEFORE we enumerate to avoid missing changes during initial crawl
  const startResp = await fetch("https://www.googleapis.com/drive/v3/changes/startPageToken", {
    headers: { Authorization: `Bearer ${providerToken}` },
    cache: "no-store",
  })
  if (!startResp.ok) return NextResponse.json({ error: `Failed to get startPageToken: ${await startResp.text()}` }, { status: 500 })
  const startJson = await startResp.json()
  const startPageToken = startJson.startPageToken as string

  // Fetch root meta and include as a node (include owner/size/created/modified and video metadata)
  const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,size,createdTime,modifiedTime,owners(displayName,emailAddress),videoMediaMetadata(width,height,durationMillis)`, {
    headers: { Authorization: `Bearer ${providerToken}` },
    cache: "no-store",
  })
  if (!metaResp.ok) return NextResponse.json({ error: `Failed to get folder meta: ${await metaResp.text()}` }, { status: 500 })
  const rootMeta = await metaResp.json()

  async function listChildren(id: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    const out: Array<{ id: string; name: string; mimeType: string }> = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams()
      params.set("q", `'${id}' in parents and trashed = false`)
      params.set("fields", "files(id,name,mimeType,size,createdTime,modifiedTime,owners(displayName,emailAddress),videoMediaMetadata(width,height,durationMillis)),nextPageToken")
      if (pageToken) params.set("pageToken", pageToken)
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}` , {
        headers: { Authorization: `Bearer ${providerToken}` },
        cache: "no-store",
      })
      if (!r.ok) throw new Error(`Drive list failed: ${await r.text()}`)
      const json = (await r.json()) as any
      out.push(...(json.files || []))
      pageToken = json.nextPageToken
    } while (pageToken)
    return out
  }

  // BFS tree build and store
  const nodesToInsert: any[] = []
  // Insert root
  nodesToInsert.push({
    sync_id: syncId,
    drive_id: rootMeta.id,
    name: rootMeta.name,
    mime_type: rootMeta.mimeType,
    is_folder: rootMeta.mimeType === "application/vnd.google-apps.folder",
    parent_drive_id: null,
    owner_name: rootMeta?.owners?.[0]?.displayName ?? null,
    owner_email: rootMeta?.owners?.[0]?.emailAddress ?? null,
    size: rootMeta?.size ? Number(rootMeta.size) : null,
    modified_time: rootMeta?.modifiedTime ? new Date(rootMeta.modifiedTime).toISOString() : null,
    created_time: rootMeta?.createdTime ? new Date(rootMeta.createdTime).toISOString() : null,
    video_duration_ms: rootMeta?.videoMediaMetadata?.durationMillis ? Number(rootMeta.videoMediaMetadata.durationMillis) : null,
    video_width: rootMeta?.videoMediaMetadata?.width ?? null,
    video_height: rootMeta?.videoMediaMetadata?.height ?? null,
  })
  const queue: Array<{ id: string; name: string; mimeType: string }> = [{ id: folderId, name: rootMeta.name, mimeType: rootMeta.mimeType }]
  const visited = new Set<string>()

  while (queue.length) {
    const cur = queue.shift()!
    if (visited.has(cur.id)) continue
    visited.add(cur.id)
    const children = await listChildren(cur.id)
    for (const ch of children) {
      const isFolder = (ch as any).mimeType === "application/vnd.google-apps.folder"
      nodesToInsert.push({
        sync_id: syncId,
        drive_id: (ch as any).id,
        name: (ch as any).name,
        mime_type: (ch as any).mimeType,
        is_folder: isFolder,
        parent_drive_id: cur.id,
        owner_name: (ch as any)?.owners?.[0]?.displayName ?? null,
        owner_email: (ch as any)?.owners?.[0]?.emailAddress ?? null,
        size: (ch as any)?.size ? Number((ch as any).size) : null,
        modified_time: (ch as any)?.modifiedTime ? new Date((ch as any).modifiedTime).toISOString() : null,
        created_time: (ch as any)?.createdTime ? new Date((ch as any).createdTime).toISOString() : null,
        video_duration_ms: (ch as any)?.videoMediaMetadata?.durationMillis ? Number((ch as any).videoMediaMetadata.durationMillis) : null,
        video_width: (ch as any)?.videoMediaMetadata?.width ?? null,
        video_height: (ch as any)?.videoMediaMetadata?.height ?? null,
      })
      if (isFolder) queue.push(ch as any)
    }
  }

  if (nodesToInsert.length) {
    const { error: insErr } = await admin.from("drive_nodes").upsert(nodesToInsert, { onConflict: "sync_id,drive_id" as any })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Initialize changes cursor with the token we captured before crawling
  const { error: cursorErr } = await admin.from("drive_cursors").upsert({ sync_id: syncId, page_token: startPageToken })
  if (cursorErr) return NextResponse.json({ error: cursorErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: nodesToInsert.length })
}


