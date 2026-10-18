import { describe, expect, it } from 'vitest'
import { ASSIGNMENT_DETECTORS, genericAssignmentDetector, passwordAssignmentDetector } from './assignments'
import { describeExamples } from './testing'
import { fake } from './helpers'

describeExamples(ASSIGNMENT_DETECTORS)

const values = (text: string, d = passwordAssignmentDetector) =>
  d.detect({ text }).map((f) => text.slice(f.startOffset, f.endOffset))

describe('password assignment spans', () => {
  it('excludes quotes', () => {
    expect(values('password = "hunter2xyz"')).toEqual(['hunter2xyz'])
    expect(values("passwd='abc 1234'")).toEqual(['abc 1234'])
    expect(values('{"password": "s3cret-value!"}')).toEqual(['s3cret-value!'])
  })

  it('handles env, YAML and CLI forms', () => {
    expect(values('DB_PASSWORD=Tr0ub4dor&3')).toEqual(['Tr0ub4dor&3'])
    expect(values('password: correcthorse9')).toEqual(['correcthorse9'])
    expect(values('mysql -u root -pSup3rSecret mydb')).toEqual(['Sup3rSecret'])
    expect(values('tool --password Zx81qLmn')).toEqual(['Zx81qLmn'])
    expect(values('sshpass -p "my pw 12" ssh host')).toEqual(['my pw 12'])
  })

  it('changeme is reported with 0.7 confidence, others 0.85', () => {
    const [weak] = passwordAssignmentDetector.detect({ text: 'password: changeme' })
    expect(weak.confidence).toBe(0.7)
    const [strong] = passwordAssignmentDetector.detect({ text: 'password: Zq81xLmnPw' })
    expect(strong.confidence).toBe(0.85)
    expect(strong.severity).toBe('critical')
    expect(strong.placeholderType).toBe('PASSWORD')
  })

  it('redacted output re-scans clean', () => {
    expect(values('password: [PASSWORD_1]\nDB_PASSWORD="[DB_PASSWORD_2]"')).toEqual([])
  })

  it('ignores more placeholders', () => {
    const cases = [
      'pwd=/home/user',
      'password: xxx',
      'password: None',
      'password: [REDACTED_PASSWORD]',
      'pass: $SECRET',
      'password = os.getenv("PW")',
    ]
    for (const t of cases) expect(values(t), t).toEqual([])
  })
})

describe('generic assignment', () => {
  it('span is the value, severity high, confidence in range', () => {
    const v = fake(32, 70)
    const text = `api_key = "${v}"`
    const [f] = genericAssignmentDetector.detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(v)
    expect(f.severity).toBe('high')
    expect(f.confidence).toBeGreaterThanOrEqual(0.6)
    expect(f.confidence).toBeLessThanOrEqual(0.9)
    expect(f.placeholderType).toBe('SECRET')
  })

  it('confidence rises with entropy and length', () => {
    const low = genericAssignmentDetector.detect({ text: 'token = "abcabcabc123"' })[0]
    const high = genericAssignmentDetector.detect({ text: 'token = "' + fake(40, 9) + '"' })[0]
    expect(high.confidence).toBeGreaterThan(low.confidence)
  })

  it('supports camelCase, kebab and env styles', () => {
    const cases = ['clientSecret: "' + fake(20, 1) + '"', 'X-Auth-Token=' + fake(20, 2), 'SIGNING_KEY=' + fake(20, 3)]
    for (const t of cases) expect(genericAssignmentDetector.detect({ text: t }), t).toHaveLength(1)
  })
})
