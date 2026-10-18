import { describe, expect, it } from 'vitest'
import { normalizeText } from './normalize'

describe('normalizeText', () => {
  it('leaves clean text untouched with an identity map', () => {
    const r = normalizeText('hello world')
    expect(r.normalized).toBe('hello world')
    expect(r.signals).toEqual([])
    expect(r.toOriginal(5)).toBe(5)
  })

  it('strips invisible chars and maps indices back', () => {
    const text = 'ab​cd​‌⁠ef'
    const r = normalizeText(text)
    expect(r.normalized).toBe('abcdef')
    expect(r.toOriginal(0)).toBe(0)
    expect(r.toOriginal(2)).toBe(3)
    expect(r.toOriginal(4)).toBe(8)
    expect(r.toOriginal(6)).toBe(text.length)
  })

  it('emits one obfuscation finding per contiguous run', () => {
    const r = normalizeText('a​​b﻿c­d')
    const inv = r.signals.filter((s) => s.detectorId === 'normalize.invisible-chars')
    expect(inv).toHaveLength(3)
    expect(inv[0]).toMatchObject({
      category: 'obfuscation',
      startOffset: 1,
      endOffset: 3,
      severity: 'low',
      confidence: 0.9,
      reasonCode: 'INVISIBLE_CHARACTERS',
      placeholderType: 'INVISIBLE',
    })
  })

  it('flags mixed-script words but not pure Cyrillic or Latin', () => {
    const mixed = normalizeText('paѕsword here') // Cyrillic dze inside a Latin word
    const sig = mixed.signals.filter((s) => s.reasonCode === 'MIXED_SCRIPT')
    expect(sig).toHaveLength(1)
    expect(sig[0]).toMatchObject({ startOffset: 0, endOffset: 8, confidence: 0.6 })
    expect(normalizeText('привет world').signals).toEqual([])
  })

  it('folds homoglyphs in the normalized text only, one unit each', () => {
    const r = normalizeText('paѕs')
    expect(r.normalized).toBe('pass')
    expect(r.normalized).toHaveLength(4)
  })

  it('handles empty and invisible-only input', () => {
    expect(normalizeText('').normalized).toBe('')
    const r = normalizeText('​​')
    expect(r.normalized).toBe('')
    expect(r.signals).toHaveLength(1)
  })
})
