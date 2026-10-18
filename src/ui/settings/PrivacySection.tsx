import type { ReactElement } from 'react'
import { ClearEverything } from './ClearEverything'
import { PRIVACY_FACTS } from './privacyFacts'
import { SettingsItem } from './SettingsItem'
import { SettingsSection } from './SettingsSection'

function CheckIcon(): ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

export function PrivacySection(): ReactElement {
  return (
    <SettingsSection id="privacy" title="Privacy" description="What this app can and can't do with your data.">
      {PRIVACY_FACTS.map((fact) => (
        <SettingsItem
          key={fact.title}
          title={fact.title}
          control={
            <p className="set-ok">
              <CheckIcon />
              <span>{fact.value}</span>
            </p>
          }
        />
      ))}
      <ClearEverything />
    </SettingsSection>
  )
}
