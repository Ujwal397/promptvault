import { describe, expect, it } from 'vitest'
import { EVAL_CORPUS, STRICT_POLICY, evaluateWithEngine, type EvalReport } from '../../core'
import { BLIND_RUN_ONE_NOTE, CORPUS_NOTES, buildAttackView } from './attackView'
import { NOT_APPLICABLE, formatMs, formatPercent } from './format'

const STRICT_RUN = { policyName: 'Strict', strict: true }
const PERMISSIVE_RUN = { policyName: 'Permissive', strict: false }

// A real run over a small slice of the synthetic corpus, so the view is checked against the engine's actual report shape.
const realReport: EvalReport = evaluateWithEngine(STRICT_POLICY, EVAL_CORPUS.slice(0, 12))

describe('buildAttackView', () => {
  it('takes every number from the report', () => {
    const view = buildAttackView(realReport, 'regression', STRICT_RUN)
    const tile = (label: string) => view.tiles.find((t) => t.label === label)?.value
    expect(tile('Precision')).toBe(formatPercent(realReport.totals.precision))
    expect(tile('Recall')).toBe(formatPercent(realReport.totals.recall))
    expect(tile('False-block rate')).toBe(formatPercent(realReport.falseBlockRate))
    expect(tile('Latency p50')).toBe(formatMs(realReport.latency.p50))
    expect(view.title).toBe(`Regression corpus, version ${realReport.corpusVersion}, 12 cases`)
    expect(view.tiles).toHaveLength(6)
  })

  it('shows a null measurement as n/a in every tile', () => {
    const empty: EvalReport = {
      ...realReport,
      totals: { ...realReport.totals, cases: 0, precision: null, recall: null },
      falseBlockRate: null,
      policyAccuracy: null,
      latency: { p50: null, p95: null, max: null },
      perCategory: {},
    }
    const view = buildAttackView(empty, 'regression', STRICT_RUN)
    const values = view.tiles.map((t) => t.value)
    expect(values.every((v) => v === NOT_APPLICABLE)).toBe(true)
    expect(view.title).toContain('0 cases')
    expect(view.categories).toEqual([])
  })

  it('uses the singular for a one-case report', () => {
    const one: EvalReport = { ...realReport, totals: { ...realReport.totals, cases: 1 } }
    expect(buildAttackView(one, 'blind', STRICT_RUN).title).toContain(', 1 case')
  })

  it('lists only categories the report measured, with expected counts and P/R', () => {
    const view = buildAttackView(realReport, 'regression', STRICT_RUN)
    const measured = Object.keys(realReport.perCategory)
    expect(view.categories.map((c) => c.category).sort()).toEqual([...measured].sort())
    for (const row of view.categories) {
      expect(row.expected).toBe(String(realReport.perCategory[row.category]?.support))
    }
  })

  it('labels the regression corpus as tuning-only, with no blind figure', () => {
    const view = buildAttackView(realReport, 'regression', STRICT_RUN)
    expect(view.notes).toContain(CORPUS_NOTES.regression)
    expect(view.notes.join(' ')).toContain('not evidence of real-world accuracy')
    expect(view.notes).not.toContain(BLIND_RUN_ONE_NOTE)
  })

  it('states the only untuned blind result (run 1) and that current results are tuned', () => {
    const view = buildAttackView(realReport, 'blind', STRICT_RUN)
    expect(view.notes).toContain(BLIND_RUN_ONE_NOTE)
    expect(BLIND_RUN_ONE_NOTE).toContain('94.2% precision and 90.7% recall')
    expect(CORPUS_NOTES.blind).toContain('tuned engine')
    expect(CORPUS_NOTES.blind).toContain('not blind')
  })

  it('says policy accuracy is not comparable when the run was not Strict', () => {
    const view = buildAttackView(realReport, 'regression', PERMISSIVE_RUN)
    expect(view.tiles.map((t) => t.label)).toContain('Policy accuracy vs Strict')
    expect(view.notes.join(' ')).toContain('not comparable')
    expect(view.notes.join(' ')).toContain('Permissive')
  })
})
