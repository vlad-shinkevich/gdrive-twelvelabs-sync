export type TwelveLabsIndex = { id: string; index_name: string }

type IndexFilters = {
  index_name?: string
  model_options?: string[] | string
  model_family?: string
  created_at?: string
  updated_at?: string
}

export async function listIndexes(options: { apiKey: string; filters?: IndexFilters }): Promise<TwelveLabsIndex[]> {
  const res = await fetch("/api/twelvelabs/indexes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: options.apiKey, filters: options.filters }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Failed to load indexes")
  }
  return (await res.json()) as TwelveLabsIndex[]
}


