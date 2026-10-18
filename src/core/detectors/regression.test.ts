import { describe, expect, it } from 'vitest'
import type { CustomRule, Detector } from '../types'
import { normalizeText } from '../normalize'
import { buildCustomDetectors } from './customRules'
import { passwordAssignmentDetector } from './secrets/assignments'
import { bip39Detector } from './secrets/crypto'
import { jdbcDetector, dbUriDetector } from './secrets/database'
import { createEntropyDetector } from './secrets/entropy'
import { privateKeyDetector } from './secrets/keys'
import { CLOUD_DETECTORS } from './secrets/cloud'
import { fake } from './secrets/helpers'
import { labeledNameDetector } from './pii/labeledName'

const slices = (d: Detector, text: string): string[] => d.detect({ text }).map((f) => text.slice(f.startOffset, f.endOffset))

describe('1. placeholder skip is anchored', () => {
  it('reports values that merely contain a placeholder-looking token', () => {
    expect(slices(passwordAssignmentDetector, 'password: Sup3r[X_1]Secret')).toEqual(['Sup3r[X_1]Secret'])
    expect(slices(dbUriDetector, 'postgres://u:Sup3r[A_1]x@h/db')).toHaveLength(1)
  })
  it('still skips a value that is wholly a placeholder', () => {
    expect(slices(passwordAssignmentDetector, 'password: [PASSWORD_1]')).toEqual([])
  })
})

describe('2. placeholder skip list is limited to real indirections', () => {
  it('reports passwords starting with $, @ or ?', () => {
    expect(slices(passwordAssignmentDetector, 'password=$uper1234Z')).toEqual(['$uper1234Z'])
    expect(slices(passwordAssignmentDetector, 'password: @dm1nPass9')).toEqual(['@dm1nPass9'])
    expect(slices(passwordAssignmentDetector, 'password: ?Qx81zLmn')).toEqual(['?Qx81zLmn'])
  })
  it('skips real indirections', () => {
    for (const v of ['${DB_PASS}', '$DB_PASS', '%DB_PASS%', '{{ db_pass }}', '<placeholder>', 'process.env.PW', 'os.environ["PW"]', 'os.getenv("PW")', 'your_password_here', 'your-password', '***', 'xxxxxx']) {
      expect(slices(passwordAssignmentDetector, `password: ${v}`), v).toEqual([])
    }
  })
  it('skips identifiers referencing another variable in code, but not quoted literals or env values', () => {
    expect(slices(passwordAssignmentDetector, 'password = confirmPassword')).toEqual([])
    expect(slices(passwordAssignmentDetector, 'password=user.password')).toEqual([])
    expect(slices(passwordAssignmentDetector, 'password = "confirmPassword"')).toEqual(['confirmPassword'])
    expect(slices(passwordAssignmentDetector, 'DB_PASSWORD=confirmPassword')).toEqual(['confirmPassword'])
  })
  it('still reports changeme', () => {
    expect(slices(passwordAssignmentDetector, 'password: changeme')).toEqual(['changeme'])
  })
})

describe('3. custom regex ReDoS validator', () => {
  const rx = (pattern: string): CustomRule => ({
    id: 'r', name: 'R', kind: 'regex', pattern, caseSensitive: false, severity: 'medium', placeholderType: 'CUSTOM', enabled: true,
  })
  const build = (pattern: string) => buildCustomDetectors([rx(pattern)])
  it.each(['a*a*b', 'a*a*a*a*b', '(ab)+', '\\d+\\w+', 'x{1,1000}', '(a)\\1', '(?=a)b', '(?<=a)b', 'a+(?!b)', 'a+b', 'a{2,}b', '\\w{1,100}\\w{1,100}'])('rejects %s', (p) => {
    const r = build(p)
    expect(r.detectors).toHaveLength(0)
    expect(r.errors).toHaveLength(1)
  })
  const accepted: Array<[string, string]> = [
    ['PRJ-\\d{4}', 'PRJ-'.repeat(25_000)],
    ['ACME-[A-Z]{2,6}-\\d{1,8}', 'ACME-AB-'.repeat(12_500)],
    ['a{1,100}b', 'a'.repeat(100_000)],
    ['internal\\s?codename', 'internal '.repeat(10_000)],
  ]
  it.each(accepted)('accepts %s and runs fast on 100k pathological chars', (p, input) => {
    const r = build(p)
    expect(r.errors).toEqual([])
    const text = input.slice(0, 100_000)
    const start = performance.now()
    r.detectors[0].detect({ text })
    expect(performance.now() - start).toBeLessThan(200)
  })
  it('does not hang on the a*a*a*a*b attack', () => {
    const r = build('a*a*a*a*b')
    expect(r.detectors).toHaveLength(0)
  })
})

describe('4. BIP39', () => {
  const valid = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  const words = valid.split(' ')
  it('finishes the CPU-DoS input quickly', () => {
    const text = ('zoo '.repeat(400) + ',').repeat(60)
    const start = performance.now()
    bip39Detector.detect({ text })
    expect(performance.now() - start).toBeLessThan(500)
  })
  it('reports unverified windows at 0.75 once the validation budget is spent', () => {
    const found = bip39Detector.detect({ text: ('zoo '.repeat(400) + ',').repeat(60) })
    expect(found.length).toBeGreaterThan(0)
    expect(found.some((f) => f.confidence === 0.75)).toBe(true)
  })
  it.each([
    ['CRLF', words.join('\r\n')],
    ['multiple spaces', words.join('   ')],
    ['tabs', words.join('\t')],
    ['commas', words.join(', ')],
    ['numbered list', words.map((w, i) => `${i + 1}. ${w}`).join(' ')],
    ['numbered lines', words.map((w, i) => `${i + 1}) ${w}`).join('\n')],
    ['capitalised', words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')],
  ])('detects a mnemonic separated by %s', (_n, text) => {
    const found = bip39Detector.detect({ text })
    expect(found).toHaveLength(1)
    expect(found[0].confidence).toBe(0.97)
    const span = text.slice(found[0].startOffset, found[0].endOffset)
    expect(span.toLowerCase()).toContain('about')
    expect(span.toLowerCase().startsWith('abandon')).toBe(true)
  })
  it('scans past 400 words', () => {
    const text = 'zoo '.repeat(450) + valid
    const found = bip39Detector.detect({ text })
    expect(found.some((f) => f.endOffset === text.length)).toBe(true)
  })
})

describe('5. normalization of invisible and look-alike characters', () => {
  const key = 'AKIAIOSFODNN7EXAMPLE'
  const cloud = (text: string) => {
    const n = normalizeText(text)
    return CLOUD_DETECTORS
      .flatMap((d) => d.detect({ text: n.normalized }))
      .filter((f) => f.category === 'cloud_credential')
      .map((f) => ({ start: n.toOriginal(f.startOffset), end: n.toOriginal(f.endOffset - 1) + 1 }))
  }
  it('strips bidi controls, tag characters and invisible operators', () => {
    for (const ch of ['‎', '‏', '‪', '‮', '⁦', '⁩', '⁡', '⁤', '\u{E0041}', '\u{E007F}']) {
      expect(normalizeText(`ab${ch}cd`).normalized, ch.codePointAt(0)?.toString(16)).toBe('abcd')
    }
  })
  it('keeps format characters that are functional in their scripts', () => {
    for (const ch of ['؀', '؅', '۝', '܏', '࣢', '\u{110BD}']) {
      expect(normalizeText(`a${ch}b`).normalized).toBe(`a${ch}b`)
    }
  })
  it('detects an AWS key hidden by an LRM, with a span over the original characters', () => {
    const text = 'AKIA‎IOSFODNN7EXAMPLE'
    expect(cloud(text)).toEqual([{ start: 0, end: text.length }])
  })
  it('detects an AWS key with a Cyrillic E', () => {
    const text = 'key ' + key.replace('E', 'Е')
    expect(cloud(text)).toEqual([{ start: 4, end: text.length }])
  })
  it('folds homoglyphs 1:1 so offsets stay valid', () => {
    const text = 'АВЕКΡαx'
    const r = normalizeText(text)
    expect(r.normalized.length).toBe(text.length)
    expect(r.normalized.slice(0, 4)).toBe('ABEK')
    expect(r.toOriginal(3)).toBe(3)
  })
  it('flags mixed-script words with 2+ Latin letters but not 5μm', () => {
    expect(normalizeText('pаssword').signals.filter((s) => s.reasonCode === 'MIXED_SCRIPT')).toHaveLength(1)
    expect(normalizeText('5μm').signals).toEqual([])
    expect(normalizeText('size 10μm').signals).toEqual([])
  })
})

describe('6. unterminated PEM', () => {
  it('covers the whole base64 tail past 10k chars', () => {
    const body = ('A'.repeat(64) + '\n').repeat(400)
    const text = 'key:\n-----BEGIN PRIVATE KEY-----\n' + body + '\nthanks for reading'
    const [f] = privateKeyDetector.detect({ text })
    expect(text.slice(f.endOffset).trim()).toBe('thanks for reading')
  })
})

describe('7. JDBC user/password@ form', () => {
  it('subspan is exactly the password', () => {
    const text = 'jdbc:oracle:thin:scott/scott@host:1521:orcl'
    const [f] = jdbcDetector.detect({ text })
    expect(f.sensitiveSubspans?.map((s) => text.slice(s.start, s.end))).toEqual(['scott'])
    expect(f.sensitiveSubspans?.[0].start).toBe(text.indexOf('/') + 1)
    const t2 = 'jdbc:oracle:thin:scott/tiger9pw@host'
    expect(jdbcDetector.detect({ text: t2 })[0].sensitiveSubspans?.map((s) => t2.slice(s.start, s.end))).toEqual(['tiger9pw'])
  })
})

describe('8. labeled name false positives', () => {
  it.each(['name: Production', 'Name: Default', 'name: Admin', 'name: Staging', 'name=Server', 'Name: Local'])('ignores %s', (t) => {
    expect(labeledNameDetector.detect({ text: t })).toEqual([])
  })
  it('still reports real names', () => {
    expect(slices(labeledNameDetector, 'Name: Alice Example')).toEqual(['Alice Example'])
    expect(slices(labeledNameDetector, 'name: Alice Example')).toEqual(['Alice Example'])
    expect(slices(labeledNameDetector, 'Name: Alice')).toEqual(['Alice'])
    expect(slices(labeledNameDetector, 'Patient: Bob')).toEqual(['Bob'])
    expect(slices(labeledNameDetector, 'Customer name: Carol')).toEqual(['Carol'])
  })
  it('does not report a single capitalised word in a YAML/code context', () => {
    expect(labeledNameDetector.detect({ text: '  name: Alice' })).toEqual([])
    expect(labeledNameDetector.detect({ text: 'name: Alice' })).toEqual([])
  })
})

describe('9. entropy token length cap', () => {
  it('detects a 600-char high-entropy token', () => {
    const detector = createEntropyDetector([])
    const text = 'blob ' + fake(600, 7)
    expect(detector.detect({ text })).toHaveLength(1)
  })
})
