import Link from "next/link"
import {
  CalendarDaysIcon,
  ListIcon,
  RadioIcon,
  Settings2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { PageHeader, PageHeaderButton, PageShell, QuickLinkCard } from "@/components/ui/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader
        title="Campaign hub"
        description="Ingest lead lists, build schedules, and generate agent workbooks from one place."
        action={
          <Link href="/dashboard/campaign/schedule">
            <PageHeaderButton>New broadcast</PageHeaderButton>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLinkCard
          href="/dashboard/campaign/lists"
          title="Lists"
          description="Upload, clean, and approve lead files for scheduling."
          icon={ListIcon}
        />
        <QuickLinkCard
          href="/dashboard/campaign/schedule"
          title="Schedule"
          description="Rank, assign agents, and configure campaign days."
          icon={CalendarDaysIcon}
        />
        <QuickLinkCard
          href="/dashboard/campaign/campaigns"
          title="Campaigns"
          description="View broadcasts and generate Excel workbooks."
          icon={RadioIcon}
        />
        <QuickLinkCard
          href="/dashboard/admin/agents"
          title="Agents"
          description="Manage outbound staff available for assignment."
          icon={UsersIcon}
        />
        <QuickLinkCard
          href="/dashboard/admin/roster"
          title="Roster"
          description="Mark agent absences by date."
          icon={UserIcon}
        />
        <QuickLinkCard
          href="/dashboard/admin/campaign-settings"
          title="Campaign settings"
          description="Create and edit parent campaigns."
          icon={Settings2Icon}
        />
      </div>

      <Card className="card-accent">
        <CardHeader>
          <CardTitle>Typical flow</CardTitle>
          <CardDescription>End-to-end in six steps</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
            <li>1. Upload & approve a list</li>
            <li>2. Open Schedule wizard</li>
            <li>3. Set exclusions & ranking</li>
            <li>4. Pick agents & volume</li>
            <li>5. Save broadcast</li>
            <li>6. Generate workbooks</li>
          </ol>
        </CardContent>
      </Card>
    </PageShell>
  )
}
