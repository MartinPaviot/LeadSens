import { cn } from "@/lib/utils"

interface SpinnerProps {
  /** Pixel size — maps to w-N h-N. Default: 24px (size-6) */
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZES = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const

/**
 * Brand-consistent loading spinner.
 * Uses the Elevay teal (#17c3b2) by default.
 */
export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-[#17c3b2] border-t-transparent animate-spin",
        SIZES[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}
