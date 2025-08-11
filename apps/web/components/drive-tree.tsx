"use client"

import * as React from "react"
import { ChevronRight, File, Folder, FileText, FileVideo, FileSpreadsheet, Image } from "lucide-react"
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react"

import { Badge } from "@workspace/ui/components/badge"
// removed page-level controls from tree
import { Input } from "@workspace/ui/components/input"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

export type DriveNode = { id?: string; name: string; type: "folder" | "file"; mimeType?: string; status: "Synced" | "In Progress" | "Not Synced"; size?: number; modifiedAt?: string; subRows?: DriveNode[] }

function FileIcon({ mimeType }: { mimeType?: string }) {
  if (!mimeType) return <File className="size-4" />
  if (mimeType.startsWith("video/")) return <FileVideo className="size-4" />
  if (mimeType.startsWith("image/")) return <Image className="size-4" />
  if (mimeType.includes("pdf") || mimeType.includes("text")) return <FileText className="size-4" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="size-4" />
  return <File className="size-4" />
}

// removed unused formatBytes for now

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
  if (node.type === "file") {
    return (
      <SidebarMenuButton className="h-8">
        <FileIcon mimeType={node.mimeType} />
        <span className="truncate text-sm">{node.name}</span>
        <span className="ml-auto" />
        <StatusBadge status={node.status} />
      </SidebarMenuButton>
    )
  }
  return (
    <SidebarMenuButton className="h-8" onClick={onClick}>
      <ChevronRight className={cn("transition-transform size-4", open ? "rotate-90" : "")} />
      <Folder className="size-4" />
      <span className="truncate text-sm">{node.name}</span>
      <span className="ml-auto" />
      <StatusBadge status={node.status} />
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
  const [open, setOpen] = React.useState(true)
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


