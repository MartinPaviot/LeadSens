'use client'

import { createContext, useContext } from 'react'
import { useSettings, type SettingsData } from '@/hooks/use-settings'

interface SettingsContextValue {
  data: SettingsData | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  data: null,
  loading: true,
  error: null,
  reload: async () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings()
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettingsContext() {
  return useContext(SettingsContext)
}
