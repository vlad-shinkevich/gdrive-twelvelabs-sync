"use client"

import * as React from "react"
import { DriveTree } from "@/components/drive-tree"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { IconCircleCheckFilled, IconPlus } from "@tabler/icons-react"
import type { DriveNode } from "@/components/drive-tree"
import { supabase } from "@/lib/supabase/client"
import { useState } from "react"
import { Input } from "@workspace/ui/components/input"
import { verifyDriveFolderLink } from "@/lib/services/drive"
import { listIndexes } from "@/lib/services/twelvelabs"

export function LibraryContent({ data }: { data: DriveNode[] }) {
  const [selectedRoot, setSelectedRoot] = React.useState<string>("all")
  const [roots, setRoots] = React.useState<DriveNode[]>(() => data)
  const [authLoading, setAuthLoading] = React.useState(false)
  const [isLinkedGoogle, setIsLinkedGoogle] = React.useState(false)

  React.useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return
      const identities = data.user?.identities || []
      setIsLinkedGoogle(identities.some((i) => i.provider === "google"))
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Load saved syncs for the user
  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch("/api/syncs", { cache: "no-store" })
        if (!res.ok) return
        const rows: Array<{ id: string; drive_folder_id: string; drive_folder_name: string }>= await res.json()
        if (canceled) return
        setRoots((prev) => {
          const mapped: DriveNode[] = rows.map((r) => ({
            id: r.drive_folder_id,
            name: r.drive_folder_name,
            type: "folder",
            status: "In Progress",
            subRows: [],
          }))
          return mapped
        })
      } catch {}
    })()
    return () => { canceled = true }
  }, [])

  const visibleData = React.useMemo(() => {
    if (selectedRoot === "all") return roots
    return roots.filter((n) => (n.id ?? n.name) === selectedRoot)
  }, [roots, selectedRoot])

  // When a specific root selected, fetch and display its actual tree from DB
  React.useEffect(() => {
    if (!selectedRoot || selectedRoot === "all") return
    let canceled = false
    ;(async () => {
      try {
        // selectedRoot соответствует drive_folder_id, используем driveId для поиска
        const res = await fetch(`/api/drive/tree/by-sync?driveId=${encodeURIComponent(selectedRoot)}`, { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (!json?.ok || !json?.tree) return
        if (canceled) return
        setRoots((prev) => prev.map((n) => {
          if ((n.id ?? n.name) !== selectedRoot) return n
          const tree = json.tree as DriveNode
          tree.status = "Synced"
          return tree
        }))
      } catch {}
    })()
    return () => { canceled = true }
  }, [selectedRoot])

  // When "All" is selected, ensure each root has its tree loaded (collapsed by default in UI)
  const loadingIds = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (selectedRoot !== "all" || !roots.length) return
    let canceled = false
    const idsToLoad = roots
      .map((r) => r.id || r.name)
      .filter((id): id is string => Boolean(id))
      .filter((id) => !loadingIds.current.has(id))
    if (!idsToLoad.length) return
    ;(async () => {
      try {
        for (const id of idsToLoad) {
          loadingIds.current.add(id)
        }
        const results = await Promise.allSettled<Promise<Response>[]>(
          idsToLoad.map((id) => fetch(`/api/drive/tree/by-sync?driveId=${encodeURIComponent(id)}`, { cache: "no-store" }))
        )
        if (canceled) return
        const trees: Record<string, DriveNode> = {}
        for (const item of results) {
          if (item.status === "fulfilled") {
            const resp = item.value
            if (resp.ok) {
              try {
                const j = await resp.json()
                if (j?.ok && j?.tree) {
                  const tree = j.tree as DriveNode
                  tree.status = "Synced"
                  const key = tree.id || tree.name
                  if (key) trees[key] = tree
                }
              } catch {}
            }
          }
        }
        if (Object.keys(trees).length) {
          setRoots((prev) => prev.map((n) => {
            const key = n.id || n.name
            if (!key) return n
            return trees[key] ? trees[key] : n
          }))
        }
      } finally {
        // keep ids marked as loaded to avoid re-fetch loops when roots state updates
      }
    })()
    return () => { canceled = true }
  }, [selectedRoot, roots])

  return (
    <>
      <div className="flex items-center justify-between">
        <Select value={selectedRoot} onValueChange={setSelectedRoot}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {roots.map((root) => (
              <SelectItem key={root.id ?? root.name} value={root.id ?? root.name}>
                {root.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <IconPlus />
                <span className="hidden lg:inline">Add Folder</span>
              </Button>
            </DialogTrigger>
            <AddFolderDialog
              onCreate={(folder) => {
                setRoots((prev) => [
                  ...prev,
                  {
                    id: folder.id,
                    name: folder.name,
                    type: "folder",
                    status: "In Progress",
                    subRows: [],
                  },
                ])
                setSelectedRoot(folder.id || folder.name)
              }}
            />
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            disabled={authLoading}
            onClick={async () => {
              try {
                setAuthLoading(true)
                const redirectTo =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/library`
                    : undefined
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    scopes: "https://www.googleapis.com/auth/drive.readonly",
                    queryParams: { access_type: "offline", prompt: "consent" },
                    redirectTo,
                  },
                })
              } finally {
                setAuthLoading(false)
              }
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-4"
              aria-hidden="true"
            >
              <path fill="#4285F4" d="M23.49 12.27c0-.74-.06-1.45-.17-2.14H12v4.06h6.44c-.28 1.52-1.12 2.8-2.39 3.66v3.04h3.86c2.26-2.08 3.58-5.14 3.58-8.62z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.86-3.04c-1.07.72-2.44 1.15-4.09 1.15-3.14 0-5.8-2.12-6.76-4.97H1.23v3.12C3.2 21.54 7.27 24 12 24z"/>
              <path fill="#FBBC05" d="M5.24 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.64H1.23C.45 8.29 0 10.1 0 12s.45 3.71 1.23 5.36l4.01-3.12z"/>
              <path fill="#EA4335" d="M12 4.74c1.76 0 3.35.61 4.6 1.8l3.44-3.44C18 1.22 15.28 0 12 0 7.27 0 3.2 2.46 1.23 6.64l4.01 3.12C6.2 6.86 8.86 4.74 12 4.74z"/>
            </svg>
            <span className="hidden lg:inline">{authLoading ? "Redirecting..." : isLinkedGoogle ? "Connected" : "Sign in"}</span>
          </Button>
        </div>
      </div>
      <SyncSummaryBar selectedRoot={selectedRoot} />
      <ChartAreaInteractive />
      <Card className="@container/card">
        <CardContent className="px-2 pt-0 sm:px-6 sm:pt-0">
          <DriveTree data={visibleData} />
        </CardContent>
      </Card>
      
      
    </>
  )
}

function AddFolderDialog({ onCreate }: { onCreate: (folder: { id: string; name: string }) => void }) {
  const [driveUrl, setDriveUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [driveOk, setDriveOk] = useState<"idle" | "ok" | "error">("idle")
  const [verifiedFolder, setVerifiedFolder] = useState<{ id: string; name: string } | null>(null)
  const [indexes, setIndexes] = useState<{ id: string; name: string }[] | null>(null)
  const [selectedIndexId, setSelectedIndexId] = useState("")
  const [loading, setLoading] = useState(false)
  const [tlOk, setTlOk] = useState<"idle" | "ok" | "error">("idle")

  async function verifyDriveLink(url: string) {
    setDriveOk("idle")
    try {
      const trimmed = (url || "").trim()
      if (!trimmed) return
      const res = await verifyDriveFolderLink(trimmed)
      if (res.ok) {
        setDriveOk("ok")
        setVerifiedFolder({ id: res.folderId, name: res.name })
      } else {
        setDriveOk("error")
        setVerifiedFolder(null)
      }
    } catch {
      setDriveOk("error")
      setVerifiedFolder(null)
    }
  }

  async function fetchTwelveLabsIndexes(key: string) {
    setLoading(true)
    setTlOk("idle")
    try {
      const data = await listIndexes({ apiKey: key })
      setIndexes(data.map((d) => ({ id: d.id, name: d.index_name })))
      setTlOk("ok")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Add Folder</DialogTitle>
        <DialogDescription>Connect a Google Drive folder and TwelveLabs index.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Google Drive folder link</label>
          <Input
            placeholder="https://drive.google.com/drive/folders/..."
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            onBlur={(e) => verifyDriveLink(e.currentTarget.value)}
          />
          {driveOk === "ok" && (
            <div className="text-green-600 text-sm inline-flex items-center gap-1">
              <IconCircleCheckFilled className="size-4 fill-green-600" />
              Access verified
            </div>
          )}
          {driveOk === "error" && (
            <div className="text-destructive text-sm">Invalid or inaccessible link</div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">TwelveLabs API key</label>
          <Input
            type="password"
            placeholder="tlsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={() => fetchTwelveLabsIndexes(apiKey)}
          />
          {tlOk === "ok" && (
            <div className="text-green-600 text-sm inline-flex items-center gap-1">
              <IconCircleCheckFilled className="size-4 fill-green-600" />
              API key valid
            </div>
          )}
          {indexes && (
            <Select value={selectedIndexId} onValueChange={setSelectedIndexId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an index" />
              </SelectTrigger>
              <SelectContent>
                {indexes.map((ix) => (
                  <SelectItem key={ix.id} value={ix.id}>{ix.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          disabled={driveOk !== "ok" || !apiKey || !indexes?.length || !selectedIndexId}
          onClick={async () => {
            const id = verifiedFolder?.id || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
            const name = verifiedFolder?.name || "Drive Folder"
            const ix = indexes?.find((i) => i.id === selectedIndexId)
            try {
              const res = await fetch("/api/syncs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  driveFolderId: id,
                  driveFolderName: name,
                  twelveIndexId: ix?.id,
                  twelveIndexName: ix?.name,
                  twelveApiKey: apiKey,
                }),
              })
              if (res.ok) {
                const created = await res.json()
                // Start background drive sync for this folder
                const startRes = await fetch("/api/drive/sync/start", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ syncId: created.id, folderId: id }),
                })
                if (startRes.ok) {
                  // Immediately run a poll to capture deltas during initial crawl
                  await fetch("/api/drive/sync/poll", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ driveId: id, pageLimit: 3 }),
                  })
                }
              }
            } catch {}
            onCreate({ id, name })
          }}
        >
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function SyncSummaryBar({ selectedRoot }: { selectedRoot: string }) {
  const [items, setItems] = React.useState<Array<{
    id: string
    name: string
    driveId: string
    createdAt: string
    counts: { total: number; folders: number; files: number; videos: number }
    lastUpdatedAt: string | null
    hasCursor: boolean
    twelveApiKey: string | null
    twelveIndexName: string
  }> | null>(null)

  React.useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch("/api/syncs/summary", { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (!json?.ok) return
        if (!canceled) setItems(json.items)
      } catch {}
    })()
    return () => { canceled = true }
  }, [])

  const visible = React.useMemo(() => {
    if (!items) return [] as NonNullable<typeof items>
    if (selectedRoot === "all") return items
    return items.filter((i) => i.driveId === selectedRoot)
  }, [items, selectedRoot])

  if (!visible || !visible.length) return null

  return (
    <div className="px-4 lg:px-6">
      {visible.map((s) => (
        <Card key={s.id} className="@container/card mb-3">
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">Overview — {s.name}</div>
              <div className="text-muted-foreground text-xs">{new Date(s.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <Button variant="outline" size="sm">Settings</Button>
            </div>
          </div>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 @xl/card:grid-cols-2 @5xl/card:grid-cols-4">
              {/* Google Drive status card */}
              <Card>
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground">Google Drive</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={"h-2 w-2 rounded-full " + (s.hasCursor ? "bg-emerald-500" : "bg-red-500")}></span>
                    <span className="text-sm">{s.hasCursor ? "Online" : "Offline"}</span>
                  </div>
                  <div className="mt-2 text-xs truncate">
                    <a className="underline underline-offset-2" href={`https://drive.google.com/drive/folders/${s.driveId}`} target="_blank" rel="noreferrer">Open folder</a>
                  </div>
                </CardContent>
              </Card>

              {/* Twelve Labs status card */}
              <Card>
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground">Twelve Labs</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={"h-2 w-2 rounded-full " + (s.twelveApiKey ? "bg-emerald-500" : "bg-red-500")}></span>
                    <span className="text-sm">{s.twelveApiKey ? "Online" : "Offline"}</span>
                  </div>
                  <div className="mt-2 text-xs"><span className="text-muted-foreground">Index:</span> {s.twelveIndexName}</div>
                  <div className="mt-1 text-xs"><span className="text-muted-foreground">API key:</span> <RevealSecret value={s.twelveApiKey || "—"} /></div>
                </CardContent>
              </Card>

              {/* Folders count */}
              <Card>
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground">Folders (Google Drive)</div>
                  <div className="text-2xl font-semibold tabular-nums">{s.counts.folders}</div>
                </CardContent>
              </Card>

              {/* Videos count */}
              <Card>
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground">Videos (Indexed)</div>
                  <div className="text-2xl font-semibold tabular-nums">{s.counts.videos}</div>
                </CardContent>
              </Card>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Updated: {s.lastUpdatedAt ? new Date(s.lastUpdatedAt).toLocaleString() : "—"}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RevealSecret({ value }: { value: string }) {
  const [show, setShow] = React.useState(false)
  return (
    <span>
      {show ? value : "••••••••"}
      <button className="ml-2 underline underline-offset-2 text-muted-foreground" onClick={() => setShow((v) => !v)}>
        {show ? "hide" : "show"}
      </button>
    </span>
  )
}


