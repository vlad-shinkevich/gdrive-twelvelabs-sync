import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"

function extractFolderIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const idFromPath = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1]
    if (idFromPath) return idFromPath
    const idFromQuery = u.searchParams.get("id")
    if (idFromQuery) return idFromQuery
  } catch {}
  return null
}

export async function POST(req: Request) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 })
  const folderId = extractFolderIdFromUrl(url)
  if (!folderId) return NextResponse.json({ error: "Invalid link" }, { status: 400 })

  // Try fetch Google identity access token from Supabase session
  try {
    const supabase = await createRouteSupabase()
    // Prefer provider_token from session (most reliable)
    const sessionRes = await supabase.auth.getSession()
    const providerToken = (sessionRes.data.session as any)?.provider_token
      || (sessionRes.data.session as any)?.provider_token
    // Fallback to identities if session token missing
    let tokenToUse: string | undefined = providerToken
    if (!tokenToUse) {
      const { data } = await supabase.auth.getUser()
      const google = data.user?.identities?.find((i: any) => i.provider === "google")
      tokenToUse = (google as any)?.identity_data?.access_token
    }
    if (!tokenToUse) {
      return NextResponse.json({ ok: false, folderId, name: "Google Drive Folder" })
    }
    const params = new URLSearchParams({ fields: "id,name,kind" })
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokenToUse}` },
    })
    if (resp.ok) {
      const meta = await resp.json()
      return NextResponse.json({ ok: true, folderId, name: meta.name || "Google Drive Folder" })
    }
    return NextResponse.json({ ok: false, folderId, name: "Google Drive Folder" }, { status: 200 })
  } catch {}

  // Fallback: unable to verify
  return NextResponse.json({ ok: false, folderId, name: "Google Drive Folder" })
}


