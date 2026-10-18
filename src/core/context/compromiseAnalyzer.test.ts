import { describe, expect, it } from 'vitest'
import { compromiseAnalyzer } from './index'

describe('compromiseAnalyzer', () => {
  it('finds people with exact offsets', () => {
    const text = 'Please email Alice Johnson about the report. Later, ask Sarah.'
    const out = compromiseAnalyzer.analyze(text)
    const names = out.map((f) => text.slice(f.startOffset, f.endOffset))
    expect(names).toContain('Alice Johnson')
    expect(names).toContain('Sarah')
    const full = out.find((f) => text.slice(f.startOffset, f.endOffset) === 'Alice Johnson')!
    expect(full).toMatchObject({
      confidence: 0.7,
      source: 'contextual',
      severity: 'medium',
      placeholderType: 'PERSON',
      detectorId: 'context.compromise-people',
      category: 'person_name',
    })
    expect(out.find((f) => text.slice(f.startOffset, f.endOffset) === 'Sarah')?.confidence).toBe(0.55)
  })

  it('excludes honorifics, lowercase and acronyms', () => {
    const text = 'Talk to Dr. Alice Johnson and bob smith from NASA.'
    const names = compromiseAnalyzer.analyze(text).map((f) => text.slice(f.startOffset, f.endOffset))
    expect(names).toContain('Alice Johnson')
    expect(names).not.toContain('bob smith')
    expect(names.join(' ')).not.toMatch(/NASA|Dr/)
  })

  it('keeps offsets in range after unusual whitespace', () => {
    const text = 'Intro line\n\n   Then   Mary Smith   arrived.'
    for (const f of compromiseAnalyzer.analyze(text)) {
      expect(f.startOffset).toBeGreaterThanOrEqual(0)
      expect(f.endOffset).toBeLessThanOrEqual(text.length)
      expect(text.slice(f.startOffset, f.endOffset)).toMatch(/^\S/)
    }
  })

  it('returns nothing for empty text and never leaks the value', () => {
    expect(compromiseAnalyzer.analyze('')).toEqual([])
    const text = 'Ask Alice Johnson.'
    for (const f of compromiseAnalyzer.analyze(text)) expect(f.explanation).not.toContain('Alice')
  })
})

describe('compromiseAnalyzer surname extension', () => {
  const names = (text: string): string[] =>
    compromiseAnalyzer.analyze(text).map((f) => text.slice(f.startOffset, f.endOffset))

  it('extends a lone given name with a following capitalised surname', () => {
    const text = 'name,email\nOliver Hartley,oliver@example.com\n'
    expect(names(text)).toContain('Oliver Hartley')
    const f = compromiseAnalyzer.analyze(text).find((x) => text.slice(x.startOffset, x.endOffset) === 'Oliver Hartley')!
    // oliver@example.com in the same row corroborates the name, so it is raised above the 0.7 extension score.
    expect(f.confidence).toBe(0.75)
  })

  it('scores an uncorroborated given name + surname at 0.7', () => {
    const text = 'name,city\nOliver Hartley,Leeds\n'
    const f = compromiseAnalyzer.analyze(text).find((x) => text.slice(x.startOffset, x.endOffset) === 'Oliver Hartley')!
    expect(f.confidence).toBe(0.7)
  })

  it('does not swallow non-name words or sentence starts', () => {
    for (const [text, bad] of [
      ['Meet Oliver Street at noon', 'Oliver Street'],
      ['Ask Oliver Monday about it', 'Oliver Monday'],
      ['I saw Oliver. Then we left.', 'Oliver. Then'],
      ['Call Oliver Ltd today', 'Oliver Ltd'],
    ] as const) {
      expect(names(text)).not.toContain(bad)
    }
  })

  it('exposes version 1.2.0', () => {
    expect(compromiseAnalyzer.version).toBe('1.2.0')
  })
})

describe('compromiseAnalyzer: names beyond the built-in lexicon', () => {
  const names = (text: string) => compromiseAnalyzer.analyze(text).map((f) => text.slice(f.startOffset, f.endOffset))

  it('finds common non-Anglo given names', () => {
    expect(names('Priya from the platform team asked me')).toContain('Priya')
    expect(names('Ping Priya Raman about the invoice')).toContain('Priya Raman')
    expect(names('Chidi and Oluwaseun reviewed it')).toEqual(expect.arrayContaining(['Chidi', 'Oluwaseun']))
  })

  it('does not treat month abbreviations or cities as names', () => {
    expect(names('Deploy on Jun 5 from the Milan office')).toEqual([])
  })

  it('raises confidence when an email in the text corroborates the name', () => {
    const text = 'Priya from the platform team asked. Error for ' + ['priya', 'sharma'].join('.') + '@example.com'
    const out = compromiseAnalyzer.analyze(text)
    const priya = out.filter((f) => text.slice(f.startOffset, f.endOffset) === 'Priya')
    expect(priya).toHaveLength(1)
    expect(priya[0]).toMatchObject({ confidence: 0.75, reasonCode: 'NLP_PERSON_EMAIL', source: 'contextual' })
  })
})
