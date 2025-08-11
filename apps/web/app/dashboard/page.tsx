import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import data from "./data.json"
import type { z } from "zod"
import { schema } from "@/components/data-table"

export default function DashboardPage() {
  return (
    <SidebarProvider
      style={{
        // match block defaults
        ["--sidebar-width" as unknown as string]: "calc(var(--spacing) * 72)",
        ["--header-height" as unknown as string]: "calc(var(--spacing) * 12)",
      }}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable data={data as unknown as z.infer<typeof schema>[]} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


