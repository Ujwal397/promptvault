import type { ReactElement } from 'react'
import { AttackSuitePanel } from './AttackSuitePanel'
import { FailureDrillPanel } from './FailureDrillPanel'
import { SettingsSection } from './SettingsSection'

export function TestingSection(): ReactElement {
  return (
    <SettingsSection id="testing" title="Testing" description="Check the scanner against tricky prompts and failures.">
      <AttackSuitePanel />
      <FailureDrillPanel />
    </SettingsSection>
  )
}
