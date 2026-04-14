'use client'

interface TabNavProps {
  tabs: Array<{ id: string; label: string; disabled?: boolean }>
  active: string
  onChange: (id: string) => void
}

export function TabNav({ tabs, active, onChange }: TabNavProps) {
  return (
    <div className="border-b px-3 sm:px-6 overflow-x-auto scrollbar-none">
      <div className="flex gap-0.5 sm:gap-1 min-w-max">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          const isDisabled = tab.disabled ?? false

          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onChange(tab.id)}
              disabled={isDisabled}
              className={`
                px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap
                ${isActive
                  ? 'text-foreground'
                  : isDisabled
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
