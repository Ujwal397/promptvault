import type { ReactElement } from 'react'
import { useActivity } from '../state/contexts'
import { retentionLabel, retentionOptions } from './format'
import { SettingsItem } from './SettingsItem'
import { SettingsSection } from './SettingsSection'
import { ToggleSwitch } from './ToggleSwitch'

/** Same activity state as the History tab's switch, so the two always agree. */
export function ActivitySection(): ReactElement {
  const activity = useActivity()
  return (
    <SettingsSection id="activity" title="Activity" description="Powers the History tab. Off by default.">
      <SettingsItem
        title="Record activity"
        description="Saves the day, outcome and counts for each scan. Never the text."
        control={<ToggleSwitch checked={activity.enabled} onChange={activity.setEnabled} label="Record activity" />}
      />
      <SettingsItem
        title="Keep records for"
        labelFor="keep-records"
        control={
          <select
            id="keep-records"
            className="set-select"
            value={activity.retentionDays}
            onChange={(event) => activity.setRetentionDays(Number(event.target.value))}
          >
            {retentionOptions(activity.retentionDays).map((days) => (
              <option key={days} value={days}>
                {retentionLabel(days)}
              </option>
            ))}
          </select>
        }
      />
    </SettingsSection>
  )
}
