import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '../types'
import { CORPUS_VERSION, EVAL_CORPUS } from './corpus'
import { AADHAAR, IBAN } from './corpus/fixtures'
import { resolveExpectation } from './match'

const INVISIBLE = /[​-‍⁠﻿­]/g
const digits = (s: string): string => s.replace(/\D/g, '')

function luhn(num: string): boolean {
  let sum = 0
  let dbl = false
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i])
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return num.length > 0 && sum % 10 === 0
}

function ibanValid(iban: string): boolean {
  const moved = iban.slice(4) + iban.slice(0, 4)
  const expanded = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of expanded) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

function verhoeff(num: string): boolean {
  let c = 0
  num.split('').reverse().forEach((ch, i) => {
    c = D[c][P[i % 8][Number(ch)]]
  })
  return c === 0
}

describe('EVAL_CORPUS', () => {
  it('has a semver version and at least 60 cases', () => {
    expect(CORPUS_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(EVAL_CORPUS.length).toBeGreaterThanOrEqual(60)
  })

  it('has unique ids', () => {
    const ids = EVAL_CORPUS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('locates every expected value in its text at the given occurrence', () => {
    for (const c of EVAL_CORPUS) {
      for (const e of c.expected) {
        const r = resolveExpectation(c.text, e)
        expect(r, `${c.id}: ${e.category}`).not.toBeNull()
        expect(c.text.slice(r!.start, r!.end)).toBe(e.value)
      }
    }
  })

  it('gives every detectable category at least two positive cases', () => {
    const detectable = CATEGORIES.filter((c) => c !== 'custom' && c !== 'obfuscation')
    for (const cat of detectable) {
      const n = EVAL_CORPUS.filter((c) => c.expected.some((e) => e.category === cat)).length
      expect(n, cat).toBeGreaterThanOrEqual(2)
    }
  })

  it('meets the tag minimums and keeps negatives free of expectations', () => {
    const count = (t: string) => EVAL_CORPUS.filter((c) => (c.tags as string[]).includes(t)).length
    expect(count('negative')).toBeGreaterThanOrEqual(15)
    expect(count('adversarial')).toBeGreaterThanOrEqual(10)
    expect(count('mixed')).toBeGreaterThanOrEqual(8)
    for (const c of EVAL_CORPUS.filter((x) => x.tags.includes('negative'))) {
      expect(c.expected).toHaveLength(0)
      expect(c.expectedDecision).toBe('allow')
    }
  })

  it('splits roughly 70/30 into dev and heldout', () => {
    const heldout = EVAL_CORPUS.filter((c) => c.split === 'heldout').length / EVAL_CORPUS.length
    expect(heldout).toBeGreaterThan(0.2)
    expect(heldout).toBeLessThan(0.4)
  })

  it('assigns strict-policy decisions consistent with expectations', () => {
    for (const c of EVAL_CORPUS.filter((x) => x.expected.length > 0)) {
      const cats = c.expected.map((e) => e.category)
      const blocks = cats.some((k) => k === 'private_key' || k === 'crypto_seed')
      const onlyIp = cats.every((k) => k === 'ip_address')
      expect(c.expectedDecision, c.id).toBe(blocks ? 'block' : onlyIp ? 'warn' : 'redact')
    }
  })

  it('uses only reserved test domains for emails', () => {
    const re = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g
    const allowed = /(^|\.)example\.(com|org|net|test)$/
    for (const c of EVAL_CORPUS) {
      for (const m of c.text.replace(INVISIBLE, '').matchAll(re)) {
        expect(m[1], c.id).toMatch(allowed)
      }
    }
  })

  it('uses Luhn-valid cards, a valid IBAN and a Verhoeff-valid Aadhaar', () => {
    const fin = EVAL_CORPUS.flatMap((c) => c.expected).filter((e) => e.category === 'financial')
    for (const e of fin) {
      if (/^[A-Z]{2}\d{2}/.test(e.value)) expect(ibanValid(e.value), e.value).toBe(true)
      else expect(luhn(digits(e.value)), e.value).toBe(true)
    }
    expect(ibanValid(IBAN)).toBe(true)
    expect(digits(AADHAAR)).toHaveLength(12)
    expect(verhoeff(digits(AADHAAR))).toBe(true)
    expect(verhoeff('234567890125')).toBe(false)
    expect(luhn('4111111111111112')).toBe(false)
    expect(ibanValid('GB82WEST12345698765433')).toBe(false)
  })

  it('keeps phone fixtures synthetic (555-01xx)', () => {
    const phones = EVAL_CORPUS.flatMap((c) => c.expected).filter((x) => x.category === 'phone' && /555/.test(x.value))
    expect(phones.length).toBeGreaterThan(0)
    for (const e of phones) expect(e.value).toMatch(/555[-. ]01\d\d/)
  })
})
