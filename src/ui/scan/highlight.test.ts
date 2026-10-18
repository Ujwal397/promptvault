import { describe, expect, it } from 'vitest'
import { segmentText, type HighlightRange } from './highlight'

const range = (start: number, end: number, id: string, severity: HighlightRange['severity'] = 'low', selected = true): HighlightRange => ({
  start,
  end,
  id,
  severity,
  selected,
})

describe('segmentText', () => {
  it('returns one plain segment when nothing is highlighted', () => {
    expect(segmentText('hello', [])).toEqual([{ text: 'hello', ids: [], severity: null, selected: false }])
  })

  it('returns no segments for empty text', () => {
    expect(segmentText('', [range(0, 0, 'a')])).toEqual([])
  })

  it('splits partially overlapping ranges into exact segments', () => {
    const segments = segmentText('abcdef', [range(1, 4, 'a', 'low'), range(3, 5, 'b', 'high', false)])
    expect(segments).toEqual([
      { text: 'a', ids: [], severity: null, selected: false },
      { text: 'bc', ids: ['a'], severity: 'low', selected: true },
      { text: 'd', ids: ['a', 'b'], severity: 'high', selected: true },
      { text: 'e', ids: ['b'], severity: 'high', selected: false },
      { text: 'f', ids: [], severity: null, selected: false },
    ])
  })

  it('takes the strongest severity for nested ranges', () => {
    const segments = segmentText('abcdef', [range(0, 6, 'outer', 'medium'), range(2, 4, 'inner', 'critical')])
    expect(segments.map((s) => [s.text, s.severity])).toEqual([
      ['ab', 'medium'],
      ['cd', 'critical'],
      ['ef', 'medium'],
    ])
    expect(segments[1]?.ids).toEqual(['outer', 'inner'])
  })

  it('keeps identical ranges as separate covering ids on one segment', () => {
    const segments = segmentText('abc', [range(0, 3, 'a', 'low'), range(0, 3, 'b', 'high')])
    expect(segments).toEqual([{ text: 'abc', ids: ['a', 'b'], severity: 'high', selected: true }])
  })

  it('ignores out-of-bounds, empty and inverted ranges', () => {
    const segments = segmentText('abc', [range(-1, 2, 'neg'), range(1, 1, 'empty'), range(2, 1, 'inverted'), range(0, 9, 'long')])
    expect(segments).toEqual([{ text: 'abc', ids: [], severity: null, selected: false }])
  })

  it('does not merge adjacent ranges that have different ids', () => {
    const segments = segmentText('abcd', [range(0, 2, 'a', 'high'), range(2, 4, 'b', 'high')])
    expect(segments.map((s) => s.text)).toEqual(['ab', 'cd'])
    expect(segments.map((s) => s.ids)).toEqual([['a'], ['b']])
  })

  it('marks a segment unselected only when every covering range is unselected', () => {
    const segments = segmentText('abcd', [range(0, 3, 'a', 'low', false), range(1, 4, 'b', 'low', true)])
    expect(segments.map((s) => s.selected)).toEqual([false, true, true])
  })

  it('always concatenates back to the original text, with overlaps and gaps', () => {
    const text = 'The quick brown fox, jumps over 12 lazy dogs.'
    const ranges = [range(4, 9, 'a'), range(6, 14, 'b'), range(20, 22, 'c'), range(40, 60, 'out-of-range')]
    const joined = segmentText(text, ranges)
      .map((s) => s.text)
      .join('')
    expect(joined).toBe(text)
  })

  it('handles surrogate pairs by offset without throwing', () => {
    const text = 'a\u{1F511}b'
    const segments = segmentText(text, [range(1, 3, 'emoji', 'high')])
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })
})
