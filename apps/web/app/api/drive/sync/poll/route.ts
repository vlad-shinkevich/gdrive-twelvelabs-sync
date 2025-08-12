import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"

type SyncRow = { id: string; drive_folder_id: string }

type GoogleDriveFile = {
  id: string
  name: string
  mimeType: string
  parents?: string[]
  trashed?: boolean
  size?: string
  createdTime?: string
  modifiedTime?: string
  owners?: Array<{ displayName: string; emailAddress: string }>
  videoMediaMetadata?: {
    width?: number
    height?: number
    durationMillis?: string
  }
}

export async function POST(req: Request) {
  const supa = await createRouteSupabase()
  const { data: userData } = await supa.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { syncId?: string; driveId?: string; pageLimit?: number }
  const pageLimit = Math.max(1, Math.min(10, body.pageLimit ?? 5))

  // Get Google provider token from session first
  const sessionRes = await supa.auth.getSession()
  let providerToken: string | undefined = sessionRes.data.session?.provider_token
  if (!providerToken) {
    const google = userData.user.identities?.find((i) => i.provider === "google")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerToken = (google?.identity_data as any)?.access_token
  }
  if (!providerToken) return NextResponse.json({ error: "Google not linked" }, { status: 403 })

  // Determine syncs to poll
  let syncs: SyncRow[] = []
  if (body.syncId) {
    const { data, error } = await supa.from("syncs").select("id, drive_folder_id").eq("id", body.syncId).limit(1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    syncs = data || []
  } else if (body.driveId) {
    const { data, error } = await supa.from("syncs").select("id, drive_folder_id").eq("drive_folder_id", body.driveId).limit(1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    syncs = data || []
  } else {
    const { data, error } = await supa.from("syncs").select("id, drive_folder_id").order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    syncs = data || []
  }

  const results: Array<{ syncId: string; processedChanges: number; pages: number }> = []

  for (const sync of syncs) {
    // Ensure cursor exists
    let cursorToken: string | null = null
    {
      const { data: cur } = await supa.from("drive_cursors").select("page_token").eq("sync_id", sync.id).maybeSingle()
      cursorToken = cur?.page_token ?? null
    }
    if (!cursorToken) {
      const startResp = await fetch("https://www.googleapis.com/drive/v3/changes/startPageToken", {
        headers: { Authorization: `Bearer ${providerToken}` },
        cache: "no-store",
      })
      if (!startResp.ok) {
        const txt = await startResp.text()
        return NextResponse.json({ error: `Failed to get startPageToken: ${txt}` }, { status: 500 })
      }
      const startJson = await startResp.json()
      cursorToken = startJson.startPageToken as string
      await supa.from("drive_cursors").upsert({ sync_id: sync.id, page_token: cursorToken })
    }

    let processed = 0
    let pages = 0
    let pageToken = cursorToken!
    let keepPaging = true

    while (keepPaging && pages < pageLimit) {
      const params = new URLSearchParams()
      params.set("pageToken", pageToken)
      params.set(
        "fields",
        [
          "nextPageToken",
          "newStartPageToken",
          "changes(fileId,removed,file(id,name,mimeType,parents,trashed,size,createdTime,modifiedTime,owners(displayName,emailAddress),videoMediaMetadata(width,height,durationMillis)))",
        ].join(",")
      )
      params.set("pageSize", "1000")

      const resp = await fetch(`https://www.googleapis.com/drive/v3/changes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${providerToken}` },
        cache: "no-store",
      })
      if (!resp.ok) {
        await resp.text()
        // Stop on 403/429 and return partial results
        break
      }
      const json = await resp.json()
      const changes = (json.changes || []) as Array<{
        fileId: string
        removed?: boolean
        file?: GoogleDriveFile
      }>

      for (const ch of changes) {
        const fid = ch.fileId || ch.file?.id
        if (!fid) continue

        if (ch.removed || ch.file?.trashed) {
          await supa.from("drive_nodes").delete().eq("sync_id", sync.id).eq("drive_id", fid)
          processed++
          continue
        }

        if (!ch.file) continue
        const isFolder = ch.file.mimeType === "application/vnd.google-apps.folder"
        const parents = ch.file.parents || []

        // Pick a parent that exists in this sync or is the root folder
        let parentId: string | null = null
        if (parents.includes(sync.drive_folder_id)) {
          parentId = sync.drive_folder_id
        } else if (parents.length) {
          const { data: parentRow } = await supa
            .from("drive_nodes")
            .select("drive_id")
            .eq("sync_id", sync.id)
            .in("drive_id", parents)
            .limit(1)
          if (parentRow && parentRow[0]) parentId = parentRow[0].drive_id
        }

        // If parent unknown and это не корень синка — пропускаем (не относится к нашему поддереву)
        if (!parentId && fid !== sync.drive_folder_id) continue

        await supa
          .from("drive_nodes")
          .upsert(
            {
              sync_id: sync.id,
              drive_id: fid,
              name: ch.file.name,
              mime_type: ch.file.mimeType,
              is_folder: isFolder,
              parent_drive_id: parentId,
              owner_name: ch.file.owners?.[0]?.displayName || null,
              owner_email: ch.file.owners?.[0]?.emailAddress || null,
              size: ch.file.size ? Number(ch.file.size) : null,
              modified_time: ch.file.modifiedTime ? new Date(ch.file.modifiedTime).toISOString() : null,
              created_time: ch.file.createdTime ? new Date(ch.file.createdTime).toISOString() : null,
              video_duration_ms: ch.file.videoMediaMetadata?.durationMillis
                ? Number(ch.file.videoMediaMetadata.durationMillis)
                : null,
              video_width: ch.file.videoMediaMetadata?.width ?? null,
              video_height: ch.file.videoMediaMetadata?.height ?? null,
            },
            { onConflict: "sync_id,drive_id" }
          )
        processed++
      }

      pages++
      if (json.nextPageToken) {
        pageToken = json.nextPageToken as string
      } else {
        // Persist newStartPageToken if provided, else keep the last pageToken
        const newStart = json.newStartPageToken as string | undefined
        await supa
          .from("drive_cursors")
          .upsert({ sync_id: sync.id, page_token: newStart || pageToken })
        keepPaging = false
      }
    }

    results.push({ syncId: sync.id, processedChanges: processed, pages })
  }

  return NextResponse.json({ ok: true, results })
}


