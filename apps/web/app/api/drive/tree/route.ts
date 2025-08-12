import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"

type DriveNode = {
  id: string
  name: string
  type: "folder" | "file"
  mimeType?: string
  status: "Synced" | "In Progress" | "Not Synced"
  subRows?: DriveNode[]
}

type GoogleDriveFile = {
  id: string
  name: string
  mimeType: string
}

export async function POST(req: Request) {
  const { folderId } = (await req.json()) as { folderId?: string }
  if (!folderId) return NextResponse.json({ error: "Missing folderId" }, { status: 400 })

  const supabase = await createRouteSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const google = data.user.identities?.find((i: { provider: string }) => i.provider === "google")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerToken = (google?.identity_data as any)?.access_token
  if (!providerToken) return NextResponse.json({ error: "Google not linked" }, { status: 403 })

  async function getMeta(id: string): Promise<GoogleDriveFile> {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType`, {
      headers: { Authorization: `Bearer ${providerToken}` },
      cache: "no-store",
    })
    if (!r.ok) throw new Error(`Drive meta failed: ${await r.text()}`)
    return (await r.json()) as GoogleDriveFile
  }

  async function listChildren(id: string): Promise<GoogleDriveFile[]> {
    const out: GoogleDriveFile[] = []
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams()
      params.set("q", `'${id}' in parents and trashed = false`)
      params.set("fields", "files(id,name,mimeType),nextPageToken")
      if (pageToken) params.set("pageToken", pageToken)
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${providerToken}` },
        cache: "no-store",
      })
      if (!r.ok) throw new Error(`Drive list failed: ${await r.text()}`)
      const json = (await r.json()) as { files?: GoogleDriveFile[]; nextPageToken?: string }
      out.push(...(json.files || []))
      pageToken = json.nextPageToken
    } while (pageToken)
    return out
  }

  const rootMeta = await getMeta(folderId)
  const root: DriveNode = {
    id: rootMeta.id,
    name: rootMeta.name,
    type: rootMeta.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
    mimeType: rootMeta.mimeType,
    status: "Synced",
    subRows: [],
  }

  // BFS to build tree
  const queue: DriveNode[] = [root]
  const limitNodes = 5000
  let count = 1
  while (queue.length && count < limitNodes) {
    const node = queue.shift()!
    if (node.type !== "folder") continue
    const children = await listChildren(node.id)
    node.subRows = children.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
      mimeType: c.mimeType,
      status: "Synced",
      subRows: [],
    }))
    for (const child of node.subRows) {
      count++
      if (child.type === "folder") queue.push(child)
      if (count >= limitNodes) break
    }
  }

  return NextResponse.json({ ok: true, tree: root })
}


