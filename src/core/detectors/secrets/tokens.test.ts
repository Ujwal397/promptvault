import { describe, expect, it } from 'vitest'
import { TOKEN_DETECTORS } from './tokens'
import { byId, describeExamples } from './testing'
import { fake } from './helpers'

describeExamples(TOKEN_DETECTORS)

describe('token span exactness', () => {
  it('GitHub token span', () => {
    const tok = 'ghp_' + fake(36, 20)
    const text = `export GH=${tok} # ci`
    const [f] = byId(TOKEN_DETECTORS, 'secret.github-token').detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(tok)
    expect(f.placeholderType).toBe('GITHUB_TOKEN')
  })

  it('OpenAI detector skips Anthropic keys, Anthropic detector takes them', () => {
    const ant = 'sk-ant-' + fake(40, 5)
    expect(byId(TOKEN_DETECTORS, 'secret.openai-key').detect({ text: ant })).toEqual([])
    expect(byId(TOKEN_DETECTORS, 'secret.anthropic-key').detect({ text: ant })).toHaveLength(1)
  })

  it('does not half-match tokens inside longer identifiers', () => {
    const text = 'my_ghp_' + fake(36, 1) + ' and AKIA_' + fake(20, 2)
    for (const d of TOKEN_DETECTORS) expect(d.detect({ text })).toEqual([])
  })

  it('Slack webhook span covers the full URL', () => {
    const url = 'https://hooks.slack.com/services/T0000FAKE/B0000FAKE/' + fake(24, 27)
    const text = `post to ${url} now`
    const [f] = byId(TOKEN_DETECTORS, 'secret.slack-webhook').detect({ text })
    expect(text.slice(f.startOffset, f.endOffset)).toBe(url)
  })
})
