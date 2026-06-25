import { Suspense } from "react"
import { ScheduleCampaignWizard } from "@/components/schedule/schedule-campaign-wizard"

export default function BroadcastPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading broadcast…</p>}>
      <ScheduleCampaignWizard />
    </Suspense>
  )
}
