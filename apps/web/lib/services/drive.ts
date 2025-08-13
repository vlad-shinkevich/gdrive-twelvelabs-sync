import { supabase } from "@/lib/supabase/client"

export async function verifyDriveFolderLink(url: string): Promise<{ ok: boolean; folderId: string; name: string; reason?: string; googleStatus?: number; googleText?: string }> {
  let providerToken: string | undefined
  try {
    const sessionRes = await supabase.auth.getSession()
    providerToken = sessionRes.data.session?.provider_token ?? undefined
    if (!providerToken) {
      const { data } = await supabase.auth.getUser()
      const google = data.user?.identities?.find((i) => i.provider === "google")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      providerToken = (google?.identity_data as any)?.access_token
    }
  } catch {
    // ignore client token fetch errors
  }

  const res = await fetch("/api/drive/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, providerToken }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Verification failed")
  }
  return (await res.json()) as { ok: boolean; folderId: string; name: string; reason?: string; googleStatus?: number; googleText?: string }
}


