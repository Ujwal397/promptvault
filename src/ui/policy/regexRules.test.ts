import { describe, expect, it } from 'vitest'
import { regexProblem } from './regexRules'

describe('regexProblem accepts bounded patterns', () => {
  it.each([
    'OPS-[0-9]{3,5}',
    'EMP-[0-9]{6}',
    'colou?r',
    '[A-Z]{2}\\d{4}',
    'x{1,64}',
    'x{1,100}',
    '\\d{1,20}-\\d{1,20}',
    'Bluebird',
    '(?:ab|cd)',
  ])('%s', (pattern) => {
    expect(regexProblem(pattern)).toBeNull()
  })
})

describe('regexProblem enforces the bounded-quantifier rule', () => {
  it.each(['a*', 'a+', 'a{2,}', '[0-9]+', '\\d+', 'EMP-[0-9]+', 'x*?'])('rejects unbounded repeats in %s', (pattern) => {
    expect(regexProblem(pattern)).toMatch(/Unbounded repeats/)
  })

  it.each(['(ab){1,3}', '(ab)?', '(?:ab)+'])('rejects quantified groups in %s', (pattern) => {
    expect(regexProblem(pattern)).toMatch(/Quantifiers on groups/)
  })

  it.each(['(?=a)b', '(?!a)b', '(?<=a)b', '(?<!a)b'])('rejects lookarounds in %s', (pattern) => {
    expect(regexProblem(pattern)).toMatch(/Lookahead and lookbehind/)
  })

  it.each(['(a)\\1', '\\k<x>'])('rejects backreferences in %s', (pattern) => {
    expect(regexProblem(pattern)).toMatch(/Backreferences/)
  })

  it('rejects repeat counts above 100 and accepts 100', () => {
    expect(regexProblem('a{1,101}')).toMatch(/above 100/)
    expect(regexProblem('a{1,100}')).toBeNull()
  })

  it('rejects patterns with too many combined choices', () => {
    expect(regexProblem('\\d{1,40}-\\d{1,40}')).toMatch(/too many variable-length parts/)
    expect(regexProblem('\\d{1,20}-\\d{1,20}')).toBeNull()
  })

  it('ignores brackets and escaped characters when looking for quantifiers', () => {
    expect(regexProblem('[*+]')).toBeNull()
    expect(regexProblem('\\*\\+')).toBeNull()
  })
})

describe('regexProblem checks syntax and matching', () => {
  it('reports patterns that do not compile', () => {
    expect(regexProblem('(')).toMatch(/not a valid regular expression/)
    expect(regexProblem('[')).toMatch(/not a valid regular expression/)
  })

  it('rejects patterns that match empty text', () => {
    expect(regexProblem('a?')).toMatch(/matches empty text/)
    expect(regexProblem('^')).toMatch(/matches empty text/)
  })
})

describe('regexProblem uses the scanner checks', () => {
  it('rejects nested quantifiers, which only the core gate checked before', () => {
    expect(regexProblem('(a{1,3}){1,3}')).not.toBeNull()
  })
})
