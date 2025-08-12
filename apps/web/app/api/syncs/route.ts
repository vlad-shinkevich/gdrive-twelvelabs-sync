import { NextResponse } from "next/server"
import { createRouteSupabase } from "@/lib/supabase/route"
import { createAdminSupabase } from "@/lib/supabase/server"

export async function GET() {
  const supa = await createRouteSupabase()
  const { data } = await supa.auth.getUser()
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createAdminSupabase()
  const { data: rows, error } = await admin
    .from("syncs")
    .select("id, drive_folder_id, drive_folder_name, twelve_index_id, twelve_index_name, twelve_api_key")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rows || [])
}

export async function POST(req: Request) {
  const body = await req.json()
  const { driveFolderId, driveFolderName, twelveIndexId, twelveIndexName, twelveApiKey } = body || {}
  if (!driveFolderId || !driveFolderName || !twelveIndexId || !twelveIndexName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }
  const supa = await createRouteSupabase()
  const { data } = await supa.auth.getUser()
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createAdminSupabase()
  const insert = {
    user_id: data.user.id,
    drive_folder_id: driveFolderId,
    drive_folder_name: driveFolderName,
    twelve_index_id: twelveIndexId,
    twelve_index_name: twelveIndexName,
    twelve_api_key: twelveApiKey ?? null,
  }
  const { data: rows, error } = await admin
    .from("syncs")
    .insert(insert)
    .select("id, drive_folder_id, drive_folder_name, twelve_index_id, twelve_index_name, twelve_api_key")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rows)
}


