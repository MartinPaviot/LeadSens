"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "@phosphor-icons/react"

interface PageHeaderProps {
  title: string
  /** Show a back button that calls router.back() */
  showBack?: boolean
  /** Extra content on the right side (buttons, toggles, etc.) */
  actions?: ReactNode
}

/**
 * Standardized 48px page header for all dashboard pages.
 */
export function PageHeader({ title, showBack, actions }: PageHeaderProps) {
  const router = useRouter()

  return (
    <div
      className="border-b px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0"
      style={{ height: "48px", minHeight: "48px" }}
    >
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  )
}
