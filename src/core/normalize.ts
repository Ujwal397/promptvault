import type { RawFinding } from './types'
import { makeFinding } from './detectors/util'

export interface NormalizedText {
  normalized: string
  /** Maps an index in `normalized` to the corresponding index in the original text. */
  toOriginal(index: number): number
  signals: RawFinding[]
}

const DETECTOR_ID = 'normalize.invisible-chars'
const VERSION = '1.0.0'

const FORMAT_CHAR = /^\p{Cf}$/u
/** Format characters that are visible or functional in their scripts, so they are kept. */
function isKeptFormatChar(cp: number): boolean {
  return (cp >= 0x0600 && cp <= 0x0605) || cp === 0x06dd || cp === 0x070f || cp === 0x08e2 || cp === 0x110bd
}

/** Code-point-aware: true for zero-width, bidi-control, tag and other invisible format characters. */
function isInvisibleCodePoint(cp: number): boolean {
  if (cp < 0xad) return false
  return !isKeptFormatChar(cp) && FORMAT_CHAR.test(String.fromCodePoint(cp))
}

/** Cyrillic/Greek look-alikes folded 1:1 (one UTF-16 unit each) to Latin, in the normalized text only. */
const HOMOGLYPHS: Readonly<Record<string, string>> = Object.fromEntries(
  (
    'е:e а:a о:o р:p с:c х:x у:y і:i ј:j ѕ:s А:A В:B Е:E К:K М:M Н:H О:O Р:P С:C Т:T Х:X ' +
    'Ο:O Α:A Β:B Ε:E Ι:I Κ:K Μ:M Ν:N Ρ:P Τ:T Χ:X Υ:Y Ζ:Z'
  )
    .split(' ')
    .map((pair) => [pair[0], pair[2]]),
)

const TOKEN = /[\p{L}\p{N}]{2,64}/gu
const LATIN_LETTERS = /[A-Za-z]/g
const NON_LATIN_LOOKALIKE = /[\p{Script=Cyrillic}\p{Script=Greek}]/u

/** Mixed-script obfuscation: at least two Latin letters alongside Cyrillic/Greek letters (so "5μm" is fine). */
function isMixedScript(token: string): boolean {
  return NON_LATIN_LOOKALIKE.test(token) && (token.match(LATIN_LETTERS)?.length ?? 0) >= 2
}

/**
 * Strips invisible characters for detection (keeping an offset map), folds common homoglyphs to Latin
 * (same length, so the map stays valid) and emits advisory obfuscation signals.
 */
export function normalizeText(text: string): NormalizedText {
  const kept: string[] = []
  const folded: string[] = []
  const map: number[] = []
  const signals: RawFinding[] = []

  const invisibleLengthAt = (at: number): number => {
    const cp = text.codePointAt(at) as number
    return isInvisibleCodePoint(cp) ? (cp > 0xffff ? 2 : 1) : 0
  }

  let i = 0
  while (i < text.length) {
    if (invisibleLengthAt(i) > 0) {
      let j = i
      for (let n = invisibleLengthAt(j); n > 0; n = j < text.length ? invisibleLengthAt(j) : 0) j += n
      signals.push(
        makeFinding({
          detectorId: DETECTOR_ID,
          detectorVersion: VERSION,
          category: 'obfuscation',
          start: i,
          end: j,
          severity: 'low',
          confidence: 0.9,
          reasonCode: 'INVISIBLE_CHARACTERS',
          recommendedAction: 'review',
          label: 'Invisible characters',
          explanation: `${j - i} zero-width or invisible character(s) found; they may hide content from review.`,
          placeholderType: 'INVISIBLE',
        }),
      )
      i = j
      continue
    }
    kept.push(text[i])
    folded.push(HOMOGLYPHS[text[i]] ?? text[i])
    map.push(i)
    i++
  }
  map.push(text.length)
  const visible = kept.join('')
  const normalized = folded.join('')

  const toOriginal = (index: number): number => {
    if (index <= 0) return map[0] ?? 0
    if (index >= map.length) return text.length
    return map[index]
  }

  for (const m of visible.matchAll(TOKEN)) {
    const tok = m[0]
    if (isMixedScript(tok)) {
      const s = m.index
      signals.push(
        makeFinding({
          detectorId: 'normalize.mixed-script',
          detectorVersion: VERSION,
          category: 'obfuscation',
          start: toOriginal(s),
          end: toOriginal(s + tok.length - 1) + 1,
          severity: 'low',
          confidence: 0.6,
          reasonCode: 'MIXED_SCRIPT',
          recommendedAction: 'review',
          label: 'Mixed-script word',
          explanation: 'A word mixes Latin letters with Cyrillic or Greek look-alikes, which can evade pattern matching.',
          placeholderType: 'INVISIBLE',
        }),
      )
    }
  }

  return { normalized, toOriginal, signals }
}
