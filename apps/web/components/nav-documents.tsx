"use client"

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@workspace/ui/components/sidebar"
import { usePathname } from "next/navigation"
import type { Icon } from "@tabler/icons-react"

type NavDocItem = { name: string; url: string; icon?: Icon }

export function NavDocuments({ items }: { items: NavDocItem[] }) {
  const pathname = usePathname()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Documents</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                asChild
                data-active={
                  pathname === item.url || pathname.startsWith(item.url + "/")
                }
              >
                <a href={item.url} className="flex items-center gap-2">
                  {item.icon ? <item.icon className="size-4" /> : null}
                  <span>{item.name}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}


