import type { ReactElement, ReactNode } from 'react'
import type { ShellTint } from '../state/contexts'

interface AppShellProps {
  tint: ShellTint
  children: ReactNode
}

/** Warm paper background with the grain overlay behind the content. The tint shows scan state only and crossfades. */
export function AppShell({ tint, children }: AppShellProps): ReactElement {
  return (
    <div className="app-surface" data-tint={tint}>
      <div className="app-tint app-tint--ember" aria-hidden="true" />
      <div className="app-tint app-tint--sage" aria-hidden="true" />
      <div className="app-grain" aria-hidden="true" />
      <div className="app-content">{children}</div>
    </div>
  )
}
