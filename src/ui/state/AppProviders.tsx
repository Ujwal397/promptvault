import type { ReactElement, ReactNode } from 'react'
import { ActivityProvider } from './ActivityContext'
import { PolicyProvider } from './PolicyContext'
import { ScanClientProvider } from './ScanClientContext'
import { SettingsProvider } from './SettingsContext'

export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  return (
    <ScanClientProvider>
      <PolicyProvider>
        <SettingsProvider>
          <ActivityProvider>{children}</ActivityProvider>
        </SettingsProvider>
      </PolicyProvider>
    </ScanClientProvider>
  )
}
