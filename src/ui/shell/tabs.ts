export const TAB_IDS = ['scan', 'policy', 'history', 'settings'] as const

export type TabId = (typeof TAB_IDS)[number]

export const TAB_LABELS: Record<TabId, string> = {
  scan: 'Scan',
  policy: 'Policy',
  history: 'History',
  settings: 'Settings',
}
