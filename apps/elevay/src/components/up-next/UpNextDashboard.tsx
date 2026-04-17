"use client"

import { Clock } from "@phosphor-icons/react"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"

export function UpNextDashboard() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Up Next" />
      <EmptyState
        icon={<Clock size={28} weight="light" style={{ color: "#17c3b2" }} />}
        title="Nothing scheduled yet"
        description="Your agents will suggest actions here as they analyze your brand — audits to re-run, campaigns to review, content to approve."
      />
    </div>
  )
}
