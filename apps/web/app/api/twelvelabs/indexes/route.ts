import { NextResponse } from "next/server"

// Universal Twelve Labs indexes listing with optional filters
// Body: { apiKey: string, filters?: { index_name?: string, model_options?: string[]|string, model_family?: string, created_at?: string, updated_at?: string } }
export async function POST(req: Request) {
  const { apiKey, filters } = await req.json()
  if (!apiKey) return NextResponse.json({ error: "Missing apiKey" }, { status: 400 })

  const url = new URL("https://api.twelvelabs.io/v1.3/indexes")
  if (filters && typeof filters === "object") {
    const params = new URLSearchParams()
    if (filters.index_name) params.set("index_name", filters.index_name)
    if (filters.model_family) params.set("model_family", filters.model_family)
    if (filters.created_at) params.set("created_at", filters.created_at)
    if (filters.updated_at) params.set("updated_at", filters.updated_at)
    if (filters.model_options) {
      const mo = Array.isArray(filters.model_options) ? filters.model_options.join(",") : String(filters.model_options)
      // use data-urlencode style encoding
      params.set("model_options", mo)
    }
    // Attach to URL for GET semantics
    url.search = params.toString()
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text || "Failed" }, { status: res.status })
  }
  const json = await res.json()
  const data = (json?.data || []).map((d: any) => ({ id: d._id, index_name: d.index_name }))
  return NextResponse.json(data)
}


