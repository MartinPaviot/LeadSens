"use client"

import { Bell } from "@phosphor-icons/react"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"

export function NotificationCenter() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Notifications" />
      <EmptyState
        icon={<Bell size={28} weight="light" style={{ color: "#17c3b2" }} />}
        title="No notifications yet"
        description="You'll see alerts from your agents here — completed audits, detected anomalies, and suggested campaigns."
      />
    </div>
  )
}
