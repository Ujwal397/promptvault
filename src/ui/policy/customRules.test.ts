import { describe, expect, it } from 'vitest'
import { CustomRuleSchema } from '../../core'
import {
  checkCustomRule,
  CUSTOM_RULE_LIMIT,
  newRuleId,
  type CustomRuleInput,
} from './customRules'

const KEYWORD: CustomRuleInput = { name: 'Project codename', kind: 'keyword', pattern: 'Bluebird', placeholderType: 'PROJECT' }
const ID = 'rule-000000000001'

function keyword(overrides: Partial<CustomRuleInput>): CustomRuleInput {
  return { ...KEYWORD, ...overrides }
}

function regex(pattern: string): CustomRuleInput {
  return { name: 'Employee ID', kind: 'regex', pattern, placeholderType: 'EMPLOYEE_ID' }
}

describe('checkCustomRule accepts valid rules', () => {
  it('builds a schema-valid keyword rule with the fixed defaults', () => {
    const result = checkCustomRule(KEYWORD, ID, 0)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rule).toEqual({
      id: ID,
      name: 'Project codename',
      kind: 'keyword',
      pattern: 'Bluebird',
      caseSensitive: false,
      severity: 'medium',
      placeholderType: 'PROJECT',
      enabled: true,
    })
    expect(CustomRuleSchema.safeParse(result.rule).success).toBe(true)
  })

  it('trims the name, pattern and placeholder', () => {
    const result = checkCustomRule(keyword({ name: '  Project codename ', pattern: ' Bluebird ', placeholderType: ' PROJECT ' }), ID, 0)
    expect(result.ok && result.rule.name).toBe('Project codename')
    expect(result.ok && result.rule.pattern).toBe('Bluebird')
    expect(result.ok && result.rule.placeholderType).toBe('PROJECT')
  })

  it('treats keywords as literal text, so regex-looking keywords are fine', () => {
    expect(checkCustomRule(keyword({ pattern: 'EMP-[0-9]+' }), ID, 0).ok).toBe(true)
  })

  it('accepts a bounded regex', () => {
    expect(checkCustomRule(regex('EMP-[0-9]{6}'), ID, 0).ok).toBe(true)
    expect(checkCustomRule(regex('OPS-[0-9]{3,5}'), ID, 0).ok).toBe(true)
  })
})

describe('checkCustomRule validates the schema fields', () => {
  it('requires a name of 1 to 60 characters', () => {
    expect(checkCustomRule(keyword({ name: '   ' }), ID, 0)).toMatchObject({ ok: false, errors: { name: expect.any(String) } })
    expect(checkCustomRule(keyword({ name: 'x'.repeat(60) }), ID, 0).ok).toBe(true)
    expect(checkCustomRule(keyword({ name: 'x'.repeat(61) }), ID, 0)).toMatchObject({ ok: false, errors: { name: expect.any(String) } })
  })

  it('requires a pattern of 1 to 200 characters', () => {
    expect(checkCustomRule(keyword({ pattern: '' }), ID, 0)).toMatchObject({ ok: false, errors: { pattern: expect.any(String) } })
    expect(checkCustomRule(keyword({ pattern: 'x'.repeat(200) }), ID, 0).ok).toBe(true)
    expect(checkCustomRule(keyword({ pattern: 'x'.repeat(201) }), ID, 0)).toMatchObject({ ok: false, errors: { pattern: expect.any(String) } })
  })

  it.each(['project', '1PROJECT', 'PROJECT-CODE', 'PROJECT CODE', '', 'A'.repeat(26)])(
    'rejects the placeholder type %j',
    (placeholderType) => {
      const result = checkCustomRule(keyword({ placeholderType }), ID, 0)
      expect(result).toMatchObject({ ok: false, errors: { placeholderType: expect.stringContaining('Placeholder type') } })
    },
  )

  it('accepts a placeholder type of up to 25 characters', () => {
    expect(checkCustomRule(keyword({ placeholderType: 'A'.repeat(25) }), ID, 0).ok).toBe(true)
  })

  it('refuses a rule when the list is already at the limit', () => {
    expect(checkCustomRule(KEYWORD, ID, CUSTOM_RULE_LIMIT)).toMatchObject({ ok: false, errors: { form: expect.stringContaining('up to 50') } })
    expect(checkCustomRule(KEYWORD, ID, CUSTOM_RULE_LIMIT - 1).ok).toBe(true)
  })
})

describe('checkCustomRule applies the regex bounding rule', () => {
  it('rejects an unbounded regex with a message that explains the rule', () => {
    const result = checkCustomRule(regex('EMP-[0-9]+'), ID, 0)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.pattern).toMatch(/Unbounded repeats \(\*, \+ and \{n,\}\) are not allowed/)
    expect(result.errors.pattern).toMatch(/\{1,20\}/)
  })

  it('rejects a regex that does not compile', () => {
    expect(checkCustomRule(regex('EMP-('), ID, 0)).toMatchObject({ ok: false, errors: { pattern: expect.stringContaining('not a valid') } })
  })

  it('does not run the regex gate for keywords', () => {
    expect(checkCustomRule(keyword({ pattern: '(' }), ID, 0).ok).toBe(true)
  })
})

describe('newRuleId', () => {
  it('returns an id that the CustomRule schema accepts', () => {
    const id = newRuleId(new Set())
    expect(id).not.toBeNull()
    expect(CustomRuleSchema.shape.id.safeParse(id).success).toBe(true)
  })

  it('skips ids that are already taken', () => {
    const values = ['aaaaaaaaaaaa', 'bbbbbbbbbbbb']
    let call = 0
    const id = newRuleId(new Set(['rule-aaaaaaaaaaaa']), () => values[call++] ?? 'cccccccccccc')
    expect(id).toBe('rule-bbbbbbbbbbbb')
  })

  it('gives up when every attempt collides', () => {
    expect(newRuleId(new Set(['rule-same']), () => 'same')).toBeNull()
  })
})
