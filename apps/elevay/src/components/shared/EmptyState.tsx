import type { ReactNode } from "react"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

/**
 * Shared empty-state component for dashboard pages.
 * Centered vertically with brand-teal icon circle.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "rgba(23,195,178,0.1)" }}
        >
          {icon}
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
