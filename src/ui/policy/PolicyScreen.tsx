import type { ReactElement } from 'react'
import './policy.css'
import './policy-rules.css'
import './policy-custom.css'
import './policy-footer.css'
import { CustomRulesCard } from './CustomRulesCard'
import { PolicyFooter } from './PolicyFooter'
import { PresetControl } from './PresetControl'
import { RulesCard } from './RulesCard'
import { usePolicyScreen } from './usePolicyScreen'
import { WhenUnsureCard } from './WhenUnsureCard'

/** Policy tab. Edits form a draft that only "Save policy" applies to the saved policy. */
export function PolicyScreen(): ReactElement {
  const model = usePolicyScreen()
  return (
    <section className="policy-screen motion-stagger" aria-labelledby="policy-title">
      <header className="policy-head">
        <div className="policy-head__text">
          <h1 id="policy-title" className="title-xl">
            Policy
          </h1>
          <p className="policy-lede">
            Decide what happens to each kind of sensitive data before a prompt leaves your hands.
          </p>
        </div>
        <PresetControl preset={model.preset} onSelect={model.onPreset} />
      </header>

      <RulesCard policy={model.draft} onRuleAction={model.onRuleAction} />

      <div className="policy-split">
        <CustomRulesCard
          rules={model.draft.customRules}
          onAdd={model.onAddCustomRule}
          onToggle={model.onToggleCustomRule}
          onRemove={model.onRemoveCustomRule}
        />
        <WhenUnsureCard
          policy={model.draft}
          onDefaultAction={model.onDefaultAction}
          onLowConfidenceAction={model.onLowConfidenceAction}
        />
      </div>

      <PolicyFooter
        dirty={model.dirty}
        importing={model.importing}
        notice={model.notice}
        onImportFile={model.onImportFile}
        onExport={model.onExport}
        onSave={model.onSave}
        onDiscard={model.onDiscard}
      />
    </section>
  )
}
