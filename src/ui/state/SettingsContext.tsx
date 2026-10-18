import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import type { PlaceholderMode } from '../../core'
import { SettingsContext } from './contexts'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from './storage'

function loadMode(): PlaceholderMode {
  const raw = readJson(STORAGE_KEYS.settings)
  const mode = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).placeholderMode : null
  return mode === 'mask' ? 'mask' : 'typed'
}

export function SettingsProvider({ children }: { children: ReactNode }): ReactElement {
  const [placeholderMode, setMode] = useState<PlaceholderMode>(loadMode)

  const setPlaceholderMode = useCallback((mode: PlaceholderMode) => {
    setMode(mode)
    writeJson(STORAGE_KEYS.settings, { placeholderMode: mode })
  }, [])

  const resetSettings = useCallback(() => {
    setMode('typed')
    removeKey(STORAGE_KEYS.settings)
  }, [])

  const value = useMemo(
    () => ({ placeholderMode, setPlaceholderMode, resetSettings }),
    [placeholderMode, setPlaceholderMode, resetSettings],
  )
  return <SettingsContext value={value}>{children}</SettingsContext>
}
