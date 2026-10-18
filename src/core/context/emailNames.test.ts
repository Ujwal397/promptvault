import { describe, expect, it } from 'vitest'
import { emailCorroboratedNames, emailNameWords } from './emailNames'

const GIVEN = new Set(['priya', 'chidi', 'oliver'])
const isGiven = (w: string): boolean => GIVEN.has(w)

const spans = (text: string): string[] => emailCorroboratedNames(text, isGiven).map((s) => text.slice(s.start, s.end))
const at = (local: string, domain = 'example.com'): string => `${local}@${domain}`

describe('emailNameWords', () => {
  it('splits local parts into name words', () => {
    expect([...emailNameWords(`mail ${at('priya.sharma')} and ${at('chidi_okafor')}`, isGiven)].sort()).toEqual([
      'chidi',
      'okafor',
      'priya',
      'sharma',
    ])
  })

  it('ignores role mailboxes, digits and short words', () => {
    expect(emailNameWords(`${at('support')} ${at('no-reply')} ${at('admin2')} ${at('j.li')}`, isGiven).size).toBe(0)
  })

  it('needs a domain after the @', () => {
    expect(emailNameWords('ping @priya or priya@ please', isGiven).size).toBe(0)
  })
})

describe('emailCorroboratedNames', () => {
  it('flags a capitalised name that matches an email in the same text', () => {
    expect(spans(`Priya from the platform team. Logs: auth failed for ${at('priya.sharma')}`)).toEqual(['Priya'])
  })

  it('merges a first and last name into one span', () => {
    expect(spans(`Ask Priya Sharma, ${at('priya.sharma')}`)).toEqual(['Priya Sharma'])
  })

  it('does not flag the email itself, lowercase words or partial words', () => {
    expect(spans(`priya said hi to Priyanka. ${at('priya.sharma')}`)).toEqual([])
  })

  it('does not flag words inside identifiers or domains', () => {
    expect(spans(`see Priya.config and Sharma_test. ${at('priya.sharma')}`)).toEqual([])
  })

  it('returns nothing when there is no email', () => {
    expect(spans('Priya from the platform team')).toEqual([])
  })

  it('stays linear on long hostile input', () => {
    const text = '@'.repeat(50_000) + 'a'.repeat(50_000)
    const t0 = performance.now()
    emailCorroboratedNames(text, isGiven)
    expect(performance.now() - t0).toBeLessThan(1000)
  })
})

describe('emailNameWords: mailbox must contain a known given name', () => {
  it('ignores brand and bot mailboxes', () => {
    expect(emailNameWords(`${at('stripe')} ${at('github-bot')} ${at('jira')}`, isGiven).size).toBe(0)
    expect(spans(`Stripe failed again, see ${at('stripe')}`)).toEqual([])
  })
})
