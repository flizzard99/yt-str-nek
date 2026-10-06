import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { ModDashboard } from "@/components/queue/mod-dashboard"

export default async function ModPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  return <ModDashboard username={session.username} />
}