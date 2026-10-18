import { useState } from 'react'
import { HistoryScreen } from './ui/history/HistoryScreen'
import { PolicyScreen } from './ui/policy/PolicyScreen'
import { ScanFlow } from './ui/scan/ScanFlow'
import { SettingsScreen } from './ui/settings/SettingsScreen'
import { AppShell } from './ui/shell/AppShell'
import { TabNav } from './ui/shell/TabNav'
import type { TabId } from './ui/shell/tabs'
import { AppProviders } from './ui/state/AppProviders'
import { ShellTintContext, type ShellTint } from './ui/state/contexts'

function App() {
  const [tab, setTab] = useState<TabId>('scan')
  const [scanTint, setScanTint] = useState<ShellTint>('neutral')
  // History holds no edits, so it remounts on each visit: its 14-day window reads the clock afresh.
  const [historyVisit, setHistoryVisit] = useState(0)

  const selectTab = (next: TabId) => {
    if (next === 'history' && tab !== 'history') setHistoryVisit((n) => n + 1)
    setTab(next)
  }

  return (
    <AppProviders>
      <ShellTintContext value={setScanTint}>
        <AppShell tint={tab === 'scan' ? scanTint : 'neutral'}>
          <header className="app-header">
            <TabNav active={tab} onSelect={selectTab} />
          </header>
          <main className="app-main">
            {/* Scan, Policy and Settings stay mounted, so a scan in progress, an unsaved policy draft or test results
                survive a tab switch (held in memory only). .motion-view replays its rise-in each time [hidden] is removed. */}
            <div className="motion-view" hidden={tab !== 'scan'}>
              <ScanFlow />
            </div>
            <div className="motion-view" hidden={tab !== 'policy'}>
              <PolicyScreen />
            </div>
            <div className="motion-view" hidden={tab !== 'history'}>
              <HistoryScreen key={historyVisit} />
            </div>
            <div className="motion-view" hidden={tab !== 'settings'}>
              <SettingsScreen />
            </div>
          </main>
        </AppShell>
      </ShellTintContext>
    </AppProviders>
  )
}

export default App
