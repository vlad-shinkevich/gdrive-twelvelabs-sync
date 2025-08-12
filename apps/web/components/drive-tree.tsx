"use client"

import * as React from "react"
import { ChevronRight, File, Folder, FileText, FileVideo, FileSpreadsheet, Image, ExternalLink, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react"

import { Badge } from "@workspace/ui/components/badge"
// removed page-level controls from tree
import { Input } from "@workspace/ui/components/input"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

export type DriveNode = {
  id?: string
  name: string
  type: "folder" | "file"
  mimeType?: string
  status: "Synced" | "In Progress" | "Not Synced"
  size?: number
  modifiedAt?: string
  createdAt?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  videoDurationMs?: number | null
  videoWidth?: number | null
  videoHeight?: number | null
  subRows?: DriveNode[]
}

function FileIcon({ mimeType }: { mimeType?: string }) {
  if (!mimeType) return <File className="size-4" />
  if (mimeType.startsWith("video/")) return <FileVideo className="size-4" />
  if (mimeType.startsWith("image/")) return <Image className="size-4" />
  if (mimeType.includes("pdf") || mimeType.includes("text")) return <FileText className="size-4" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="size-4" />
  return <File className="size-4" />
}

function formatBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return undefined
  const units = ["B", "KB", "MB", "GB", "TB"]
  let b = bytes
  let i = 0
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024
    i++
  }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(iso?: string) {
  if (!iso) return undefined
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return undefined
    return d.toLocaleString()
  } catch {
    return undefined
  }
}

function formatDuration(ms?: number | null) {
  if (!ms && ms !== 0) return undefined
  const total = Math.floor((ms as number) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts = [h > 0 ? String(h).padStart(2, "0") : null, String(m).padStart(2, "0"), String(s).padStart(2, "0")].filter(Boolean)
  return parts.join(":")
}

function StatusBadge({ status }: { status: DriveNode["status"] }) {
  if (status === "Synced") {
    return (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
        Synced
      </Badge>
    )
  }
  if (status === "In Progress") {
    return (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        <IconLoader className="animate-spin" style={{ animationDuration: "1.5s" }} />
        In Progress
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground px-1.5">
      Not Synced
    </Badge>
  )
}

function Name({ node, onClick, open }: { node: DriveNode; onClick?: () => void; open?: boolean }) {
  const sizeText = formatBytes(node.size)
  const dateText = formatDate(node.modifiedAt)
  const ownerText = node.ownerName || undefined
  const createdText = formatDate(node.createdAt || undefined)
  const durationText = formatDuration(node.videoDurationMs)
  const dimsText = node.videoWidth && node.videoHeight ? `${node.videoWidth}×${node.videoHeight}` : undefined
  const tooltipLines = [
    node.mimeType,
    ownerText && `Owner: ${ownerText}`,
    sizeText && `Size: ${sizeText}`,
    createdText && `Created: ${createdText}`,
    durationText && `Duration: ${durationText}`,
    dimsText && `Dimensions: ${dimsText}`,
  ].filter(Boolean) as string[]
  const tooltip = tooltipLines.filter(Boolean).length ? (
    <div className="flex min-w-56 max-w-80 flex-col gap-1">
      {node.mimeType && <div className="text-[11px] opacity-80">{node.mimeType}</div>}
      {ownerText && (
        <div className="text-xs"><span className="opacity-70">Owner:</span> {ownerText}</div>
      )}
      {sizeText && (
        <div className="text-xs"><span className="opacity-70">Size:</span> {sizeText}</div>
      )}
      {createdText && (
        <div className="text-xs"><span className="opacity-70">Created:</span> {createdText}</div>
      )}
      {(durationText || dimsText) && (
        <div className="text-xs">
          {durationText && (<><span className="opacity-70">Duration:</span> {durationText}</>)}
          {durationText && dimsText && <span className="opacity-60"> • </span>}
          {dimsText && (<><span className="opacity-70">Dimensions:</span> {dimsText}</>)}
        </div>
      )}
    </div>
  ) : undefined
  const rightText = dateText
  const openLink = node.id ? `https://drive.google.com/file/d/${node.id}/view` : undefined
  if (node.type === "file") {
    return (
      <SidebarMenuButton className="h-8 group relative">
        <FileIcon mimeType={node.mimeType} />
        <span className="truncate text-sm">{node.name}</span>
        <span className="ml-auto" />
        {rightText && (
          <span className="text-xs text-muted-foreground mr-2 min-w-[8rem] text-left">{rightText}</span>
        )}
        <StatusBadge status={node.status} />
        {tooltip && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="ml-1 hidden cursor-help items-center text-muted-foreground group-hover:inline-flex">
                <Info className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <div className="flex flex-col gap-2">
                {tooltip}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {openLink && (
          <span className="ml-1 hidden group-hover:inline-flex">
            <a
              href={openLink}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open in Google Drive"
              title="Open in Google Drive"
            >
              <ExternalLink className="size-3" />
            </a>
          </span>
        )}
      </SidebarMenuButton>
    )
  }
  return (
    <SidebarMenuButton className="h-8 group relative" onClick={onClick}>
      <ChevronRight className={cn("transition-transform size-4", open ? "rotate-90" : "")} />
      <Folder className="size-4" />
      <span className="truncate text-sm">{node.name}</span>
      <span className="ml-auto" />
      {rightText && (
        <span className="text-xs text-muted-foreground mr-2 min-w-[8rem] text-left">{rightText}</span>
      )}
      <StatusBadge status={node.status} />
      {tooltip && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="ml-1 hidden cursor-help items-center text-muted-foreground group-hover:inline-flex">
              <Info className="size-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>{tooltip}</TooltipContent>
        </Tooltip>
      )}
      {openLink && (
        <span className="ml-1 hidden group-hover:inline-flex">
          <a
            href={openLink}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open in Google Drive"
            title="Open in Google Drive"
          >
            <ExternalLink className="size-3" />
          </a>
        </span>
      )}
    </SidebarMenuButton>
  )
}

export function DriveTree({ data }: { data: DriveNode[] }) {
  const [filter, setFilter] = React.useState("")
  const visibleRoots = React.useMemo(() => {
    if (!filter) return data
    return data.filter((n) => n.name.toLowerCase().includes(filter.toLowerCase()))
  }, [data, filter])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-0">
        <Input
          placeholder="Search"
          className="h-8 w-56"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="px-0">
        <SidebarMenu>
          {visibleRoots.map((node, i) => (
            <Tree key={i} node={node} />
          ))}
        </SidebarMenu>
      </div>
    </div>
  )
}

function Tree({ node }: { node: DriveNode }) {
  const [open, setOpen] = React.useState(false)
  if (node.type === "file") {
    return (
      <SidebarMenuItem>
        <Name node={node} />
      </SidebarMenuItem>
    )
  }
  return (
    <SidebarMenuItem>
      <Name node={node} onClick={() => setOpen((v) => !v)} open={open} />
      {open && (
        <SidebarMenuSub className="mx-0 mr-0 ml-3.5 px-0 pl-2.5 pr-0">
          {node.subRows?.map((child, i) => (
            <Tree key={i} node={child} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}


