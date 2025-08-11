"use client"

import * as React from "react"
import { DriveTree } from "@/components/drive-tree"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { IconPlus } from "@tabler/icons-react"
import type { DriveNode } from "./data"

export function LibraryContent({ data }: { data: DriveNode[] }) {
  const [selectedRoot, setSelectedRoot] = React.useState<string>("all")

  const visibleData = React.useMemo(() => {
    if (selectedRoot === "all") return data
    return data.filter((n) => (n.id ?? n.name) === selectedRoot)
  }, [data, selectedRoot])

  return (
    <>
      <div className="flex items-center justify-between">
        <Select value={selectedRoot} onValueChange={setSelectedRoot}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {data.map((root) => (
              <SelectItem key={root.id ?? root.name} value={root.id ?? root.name}>
                {root.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Folder</span>
          </Button>
          <Button variant="outline" size="sm">
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
            <span className="hidden lg:inline">Sign in</span>
          </Button>
        </div>
      </div>
      <ChartAreaInteractive />
      <Card className="@container/card">
        <CardContent className="px-2 pt-0 sm:px-6 sm:pt-0">
          <DriveTree data={visibleData} />
        </CardContent>
      </Card>
    </>
  )
}


