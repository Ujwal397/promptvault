import type { Detector } from '../../types'
import { B64URL, fake, hasMinEntropy, patternDetector, type PatternRule } from './helpers'

const HEX = '0123456789abcdef'
const DIGITS = '0123456789'

/** Single-pattern provider detector with the usual defaults. */
export function provider(
  id: string,
  label: string,
  placeholder: string,
  re: RegExp,
  confidence: number,
  examples: { positive: string[]; negative: string[] },
  extra: Partial<PatternRule> = {},
): Detector {
  return patternDetector({
    id,
    category: 'cloud_credential',
    description: label,
    examples,
    patterns: [
      {
        re,
        label,
        placeholder,
        explanation: `Matches the format of a ${label} (known prefix and length).`,
        confidence,
        severity: 'critical',
        ...extra,
      },
    ],
  })
}

const github = patternDetector({
  id: 'secret.github-token',
  category: 'cloud_credential',
  description: 'GitHub personal/OAuth/app token or fine-grained PAT',
  examples: {
    positive: ['token ghp_' + fake(36, 20), 'GH=github_pat_' + fake(40, 21)],
    negative: ['ghp_short', 'xghp_' + fake(36, 22), 'github_pat_abc'],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g,
      label: 'GitHub token',
      placeholder: 'GITHUB_TOKEN',
      explanation: 'Matches the format of a GitHub token (gh*_ prefix, 40 characters).',
      confidence: 0.95,
      severity: 'critical',
    },
    {
      re: /(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{22,255}(?![A-Za-z0-9_])/g,
      label: 'GitHub fine-grained token',
      placeholder: 'GITHUB_TOKEN',
      explanation: 'Matches the format of a GitHub fine-grained personal access token.',
      confidence: 0.95,
      severity: 'critical',
    },
  ],
})

const gitlab = provider(
  'secret.gitlab-token',
  'GitLab personal access token',
  'GITLAB_TOKEN',
  /(?<![A-Za-z0-9_-])glpat-[A-Za-z0-9_-]{20}(?![A-Za-z0-9_-])/g,
  0.95,
  { positive: ['glpat-' + fake(20, 23, B64URL)], negative: ['glpat-short', 'glpat-' + fake(30, 24, B64URL)] },
)

const slackToken = provider(
  'secret.slack-token',
  'Slack token',
  'SLACK_TOKEN',
  /(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,72}(?![A-Za-z0-9-])/g,
  0.95,
  { positive: ['xoxb-' + '123456789012-' + fake(24, 25)], negative: ['xoxb-short', 'xoxz-' + fake(20, 26)] },
)

const slackWebhook = provider(
  'secret.slack-webhook',
  'Slack webhook URL',
  'SLACK_WEBHOOK',
  /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{8,12}\/[A-Z0-9]{8,12}\/[A-Za-z0-9]{20,40}/g,
  0.95,
  {
    positive: ['curl https://hooks.slack.com/services/T0000FAKE/B0000FAKE/' + fake(24, 27)],
    negative: ['https://hooks.slack.com/services/', 'https://slack.com/help'],
  },
)

const anthropic = provider(
  'secret.anthropic-key',
  'Anthropic API key',
  'ANTHROPIC_KEY',
  /(?<![A-Za-z0-9_-])sk-ant-[A-Za-z0-9_-]{20,200}/g,
  0.95,
  { positive: ['ANTHROPIC_API_KEY=sk-ant-' + 'api03-' + fake(40, 28, B64URL)], negative: ['sk-ant-short', 'task-ant-' + fake(30, 29)] },
)

const openai = provider(
  'secret.openai-key',
  'OpenAI API key',
  'OPENAI_KEY',
  /(?<![A-Za-z0-9_-])sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,200}/g,
  0.9,
  {
    positive: ['OPENAI_API_KEY=sk-' + fake(48, 30), 'sk-' + 'proj-' + fake(60, 31, B64URL)],
    negative: ['sk-short', 'risk-assessment-framework-document-v2', 'sk-ant-' + fake(30, 32)],
  },
  { accept: hasMinEntropy(3.2) },
)

const huggingface = provider(
  'secret.huggingface-token',
  'Hugging Face token',
  'HF_TOKEN',
  /(?<![A-Za-z0-9_])hf_[A-Za-z0-9]{34}(?![A-Za-z0-9])/g,
  0.95,
  { positive: ['HF_TOKEN=hf_' + fake(34, 33)], negative: ['hf_short', 'chf_' + fake(34, 34)] },
)

const npm = provider(
  'secret.npm-token',
  'npm access token',
  'NPM_TOKEN',
  /(?<![A-Za-z0-9_])npm_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g,
  0.95,
  { positive: ['//registry.npmjs.org/:_authToken=npm_' + fake(36, 35)], negative: ['npm_install_all', 'npm_' + fake(20, 36)] },
)

const sendgrid = provider(
  'secret.sendgrid-key',
  'SendGrid API key',
  'SENDGRID_KEY',
  /(?<![A-Za-z0-9])SG\.[\w-]{22}\.[\w-]{43}(?![\w-])/g,
  0.95,
  { positive: ['SG.' + fake(22, 37, B64URL) + '.' + fake(43, 38, B64URL)], negative: ['SG.short.key', 'SG.' + fake(10, 39)] },
)

const twilio = provider(
  'secret.twilio-key',
  'Twilio API key SID',
  'TWILIO_KEY',
  /(?<![A-Za-z0-9])SK[0-9a-f]{32}(?![A-Za-z0-9])/g,
  0.85,
  { positive: ['api_key_sid = SK' + fake(32, 40, HEX)], negative: ['SKU' + fake(32, 41, HEX), 'SK1234'] },
)

const googleOauth = provider(
  'secret.google-oauth-token',
  'Google OAuth access token',
  'GOOGLE_OAUTH_TOKEN',
  /(?<![A-Za-z0-9])ya29\.[\w-]{20,512}/g,
  0.9,
  { positive: ['Bearer ya29.' + fake(60, 42, B64URL)], negative: ['ya29.short', 'ya29'] },
)

const telegram = provider(
  'secret.telegram-bot-token',
  'Telegram bot token',
  'TELEGRAM_TOKEN',
  /(?<![A-Za-z0-9:])\d{8,10}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g,
  0.85,
  {
    positive: ['bot_token=123456789:' + fake(35, 43, B64URL)],
    negative: ['12:34:56 meeting', '123456789:short', '1234567:' + fake(35, 44)],
  },
)

const mailgun = provider(
  'secret.mailgun-key',
  'Mailgun API key',
  'MAILGUN_KEY',
  /(?<![A-Za-z0-9_-])key-[0-9a-f]{32}(?![A-Za-z0-9])/g,
  0.9,
  { positive: ['api:key-' + fake(32, 45, HEX)], negative: ['key-value-store', 'monkey-' + fake(32, 46, HEX)] },
)

const discordWebhook = provider(
  'secret.discord-webhook',
  'Discord webhook URL',
  'DISCORD_WEBHOOK',
  /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[A-Za-z0-9_-]{60,80}/g,
  0.95,
  {
    positive: ['https://discord.com/api/webhooks/' + fake(18, 47, DIGITS) + '/' + fake(68, 48, B64URL)],
    negative: ['https://discord.com/api/webhooks/', 'https://discord.com/channels/123/456'],
  },
)

export const TOKEN_DETECTORS: Detector[] = [
  github,
  gitlab,
  slackToken,
  slackWebhook,
  anthropic,
  openai,
  huggingface,
  npm,
  sendgrid,
  twilio,
  googleOauth,
  telegram,
  mailgun,
  discordWebhook,
]
