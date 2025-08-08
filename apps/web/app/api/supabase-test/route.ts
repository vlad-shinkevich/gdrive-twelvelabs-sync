export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/server"

// GET: проверяет подключение, возвращает количество записей в таблице todos
export async function GET() {
  try {
    const supabase = createAdminSupabase()
    const { count, error } = await supabase
      .from("todos")
      .select("*", { count: "exact", head: true })

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, count: count ?? 0 })
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: (e as Error).message },
      { status: 500 }
    )
  }
}

// POST: создаёт тестовую запись в таблице todos
export async function POST(request: Request) {
  try {
    const supabase = createAdminSupabase()
    const body = await request.json().catch(() => ({})) as { title?: string }
    const title = body.title ?? "Test from API"

    const { error } = await supabase
      .from("todos")
      .insert({ title })

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: (e as Error).message },
      { status: 500 }
    )
  }
}


