import type { ReactElement } from 'react'
import { ActivitySection } from './ActivitySection'
import { PrivacySection } from './PrivacySection'
import { RedactionSection } from './RedactionSection'
import { TestingSection } from './TestingSection'
import './settings.css'
import './settingsResults.css'

/** Settings tab: redaction, activity, testing and privacy. Each section lives in its own file. */
export function SettingsScreen(): ReactElement {
  return (
    <section className="set-screen motion-stagger">
      <header className="set-intro">
        <h1 className="title-xl">Settings</h1>
        <p className="set-lede">How redaction looks, what gets remembered, and tools to test the scanner.</p>
      </header>
      <RedactionSection />
      <ActivitySection />
      <TestingSection />
      <PrivacySection />
    </section>
  )
}
