import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="bg-sidebar">
      <AppSidebar className="!border-r-0" />
      <SidebarInset className="min-h-svh flex-1 bg-transparent">
        <header className="chrome-header sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2">
          <div className="flex w-full items-center gap-3 px-4">
            <SidebarTrigger className="-ml-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            <span className="hidden text-xs font-semibold tracking-wide text-sidebar-foreground/90 sm:inline">
              X-Sell · Outbound campaigns
            </span>
          </div>
        </header>
        <div className="dashboard-panel flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}