export async function verifyDriveFolderLink(url: string): Promise<{ ok: boolean; folderId: string; name: string }> {
  const res = await fetch("/api/drive/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Verification failed")
  }
  return (await res.json()) as { ok: boolean; folderId: string; name: string }
}


