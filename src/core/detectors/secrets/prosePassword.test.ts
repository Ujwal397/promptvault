import { describe, expect, it } from 'vitest'
import { prosePasswordDetector } from './prosePassword'
import { describeExamples } from './testing'

describeExamples([prosePasswordDetector])

const values = (text: string) =>
  prosePasswordDetector.detect({ text }).map((f) => text.slice(f.startOffset, f.endOffset))

describe('secret.prose-password positives', () => {
  it.each([
    ['my password is Tr0ub4dor&3', ['Tr0ub4dor&3']],
    ['the wifi password is: sunflower22', ['sunflower22']],
    ['password for the server was Hunter2!', ['Hunter2!']],
    ['use password Xy9#kLm2', ['Xy9#kLm2']],
    ['passcode 482913', ['482913']],
    ['the PIN is 4829', ['4829']],
    ['login: admin / pass: Adm1n2024', ['Adm1n2024']],
    ['username jdoe and password Summer2024!', ['Summer2024!']],
    ['my password is "Tr0ub4dor&3".', ['Tr0ub4dor&3']],
    ['using password HunterTwo to log in', ['HunterTwo']],
  ])('%s', (text, expected) => {
    expect(values(text)).toEqual(expected)
  })

  it('sets metadata for passwords and PINs', () => {
    const [pw] = prosePasswordDetector.detect({ text: 'my password is Tr0ub4dor&3' })
    expect(pw).toMatchObject({
      category: 'credential',
      severity: 'critical',
      confidence: 0.75,
      placeholderType: 'PASSWORD',
      detectorId: 'secret.prose-password',
      detectorVersion: '1.0.0',
    })
    expect(pw.explanation).not.toContain('Tr0ub4dor')
    const [pin] = prosePasswordDetector.detect({ text: 'the PIN is 4829' })
    expect(pin).toMatchObject({ confidence: 0.65, placeholderType: 'PIN', severity: 'critical' })
    const [pc] = prosePasswordDetector.detect({ text: 'passcode 482913' })
    expect(pc.placeholderType).toBe('PIN')
  })
})

describe('secret.prose-password negatives', () => {
  it.each([
    'Please reset your password',
    'password is required',
    'the password policy is strict',
    'forgot my password again',
    'password must be 12 characters',
    'enter the PIN when prompted',
    'pin the issue to the top',
    'pass the test',
    'pass is 4 (a mountain pass)',
    'my password is [PASSWORD_1]',
    'the password is <password>',
    'password is ***',
    'your password has expired',
    'the password was changed',
    'password is incorrect',
    'password: ${DB_PASS}',
    'password = getPassword()',
    'the compass is Xy9#kLm2',
    'password is 12-characters',
  ])('%s', (text) => {
    expect(values(text)).toEqual([])
  })
})

describe('secret.prose-password performance', () => {
  it.each([
    ['password is ', 'password is '],
    ['pin ', 'pin '],
    ['pass ', 'pass '],
    ['password - ', 'password - '],
  ])('100k of %s< 300 ms', (_n, unit) => {
    const text = unit.repeat(Math.floor(100_000 / unit.length))
    const t = performance.now()
    prosePasswordDetector.detect({ text })
    expect(performance.now() - t).toBeLessThan(300)
  })
})

describe('placeholder output re-scans clean', () => {
  it.each(['"password": "[PASSWORD_1]",', 'my password is [PASSWORD_2].', 'pin: [PIN_1]'])('%s', (text) => {
    expect(prosePasswordDetector.detect({ text })).toEqual([])
  })
  it('still reports a secret that merely contains a placeholder-like suffix', () => {
    expect(prosePasswordDetector.detect({ text: 'my password is Sup3r[X_1]' }).length).toBe(1)
  })
})
