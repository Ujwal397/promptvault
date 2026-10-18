import { describe, expect, it } from 'vitest'
import { makeDecision, makeFinding } from './scanFixtures'
import {
  countNeedingAttention,
  decisionMap,
  defaultSelection,
  idsToRedact,
  isChecked,
  retainedIds,
  toggleSelection,
} from './selection'

// Synthetic prompt: four findings, one per decision type.
const findings = [
  makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 5 }), // redact, optional
  makeFinding({ findingId: 'f-1', startOffset: 10, endOffset: 20, category: 'credential', label: 'API key' }), // mandatory
  makeFinding({ findingId: 'f-2', startOffset: 30, endOffset: 40, category: 'ip_address', label: 'IP address' }), // allow
  makeFinding({ findingId: 'f-3', startOffset: 50, endOffset: 55, source: 'contextual', label: 'Person name' }), // warn
]
const decisions = decisionMap([
  makeDecision('f-0', 'redact'),
  makeDecision('f-1', 'redact', { mandatory: true }),
  makeDecision('f-2', 'allow'),
  makeDecision('f-3', 'warn'),
])

describe('defaultSelection', () => {
  it('ticks everything the policy would act on, plus every locked finding', () => {
    expect([...defaultSelection(findings, decisions)]).toEqual(['f-0', 'f-1', 'f-3'])
  })

  it('leaves allow decisions unticked', () => {
    expect(defaultSelection(findings, decisions).has('f-2')).toBe(false)
  })

  it('treats a finding with no decision as locked and ticked', () => {
    const extra = [...findings, makeFinding({ findingId: 'f-9', startOffset: 60, endOffset: 65 })]
    expect(defaultSelection(extra, decisions).has('f-9')).toBe(true)
  })
})

describe('toggleSelection', () => {
  it('unticks an optional finding and ticks it back', () => {
    const off = toggleSelection(defaultSelection(findings, decisions), decisions, 'f-0')
    expect(off.has('f-0')).toBe(false)
    expect(toggleSelection(off, decisions, 'f-0').has('f-0')).toBe(true)
  })

  it('cannot untick a mandatory finding, and returns the same set', () => {
    const selected = defaultSelection(findings, decisions)
    expect(toggleSelection(selected, decisions, 'f-1')).toBe(selected)
  })

  it('never mutates the set it is given', () => {
    const selected = defaultSelection(findings, decisions)
    toggleSelection(selected, decisions, 'f-0')
    expect(selected.has('f-0')).toBe(true)
  })
})

describe('retainedIds', () => {
  it('lists unticked findings the policy would act on', () => {
    const selected = new Set(['f-1', 'f-3'])
    expect(retainedIds(findings, decisions, selected)).toEqual(['f-0'])
  })

  it('never lists an allow decision or a locked finding', () => {
    const selected = new Set<string>()
    expect(retainedIds(findings, decisions, selected)).toEqual(['f-0', 'f-3'])
  })

  it('is empty when everything needing action is ticked', () => {
    expect(retainedIds(findings, decisions, defaultSelection(findings, decisions))).toEqual([])
  })
})

describe('idsToRedact', () => {
  it('includes ticked findings and every locked finding, even if the set lacks them', () => {
    expect(idsToRedact(findings, decisions, new Set(['f-2']))).toEqual(['f-1', 'f-2'])
  })

  it('keeps document order', () => {
    expect(idsToRedact(findings, decisions, defaultSelection(findings, decisions))).toEqual(['f-0', 'f-1', 'f-3'])
  })
})

describe('isChecked and countNeedingAttention', () => {
  it('shows locked findings as checked even when the set does not hold them', () => {
    expect(isChecked('f-1', decisions, new Set())).toBe(true)
    expect(isChecked('f-0', decisions, new Set())).toBe(false)
  })

  it('counts findings whose decision is not allow', () => {
    expect(countNeedingAttention(findings, decisions)).toBe(3)
  })
})
