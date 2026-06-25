import { redirect } from "next/navigation"

/** @deprecated Use /dashboard/campaign/broadcast */
export default function ScheduleRedirectPage() {
  redirect("/dashboard/campaign/broadcast")
}
