import { mk, type EvalCase } from './helpers'

const N: ['negative'] = ['negative']
const NC: ['negative', 'code'] = ['negative', 'code']

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export const NEGATIVE_CASES: EvalCase[] = [
  mk('dev', 'neg-uuid', 'UUID', 'Trace id 123e4567-e89b-12d3-a456-426614174000 appears in the log.', [], 'allow', N),
  mk('dev', 'neg-git-sha', 'Git commit SHA', 'The regression came in with commit 9fceb02d0ae598e95dc970b74767f19372d61af8.', [], 'allow', N),
  mk('heldout', 'neg-sha256', 'SHA-256 digest',
    'Checksum: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', [], 'allow', N),
  mk('dev', 'neg-css-hex', 'CSS hex colours', '.btn { color: #ff5733; background: #1a2b3c; border-color: #FFF; }', [], 'allow', NC),
  mk('dev', 'neg-data-uri', 'Base64 PNG data URI', `<img src="data:image/png;base64,${PNG_B64}" alt="pixel">`, [], 'allow', NC),
  mk('dev', 'neg-semver', 'Semver and version strings', 'Upgrade from v2.14.3 to 3.0.0-rc.1 and Node 20.11.1.', [], 'allow', N),
  mk('heldout', 'neg-dates', 'Dates and times', 'The meeting moved from 2025-01-15 to 15/02/2025 at 14:30:00Z.', [], 'allow', N),
  mk('dev', 'neg-reset-prose', 'Password prose without a value', 'How do I reset your password when the email link has expired?', [], 'allow', N),
  mk('dev', 'neg-key-in-env-prose', 'Sensitive words, no value', 'The API key is stored in an environment variable and never committed.', [], 'allow', N),
  mk('dev', 'neg-password-template', 'Templated password', 'password: ${DB_PASS}\nusername: ${DB_USER}', [], 'allow', NC),
  mk('heldout', 'neg-api-key-environ', 'API key read from environment', 'api_key=os.environ["KEY"]\nclient = Client(api_key=api_key)', [], 'allow', NC),
  mk('dev', 'neg-order-number', 'Order and ticket numbers', 'Order #1234567890 shipped; ticket TCK-20240517-0042 is closed.', [], 'allow', N),
  mk('dev', 'neg-twelve-words', 'Normal 12-word English sentence', 'the quick brown fox jumps over the lazy dog while seven cats', [], 'allow', N),
  mk('heldout', 'neg-code-clean', 'Code without secrets',
    'export function add(a: number, b: number): number {\n  return a + b\n}\nconsole.assert(add(2, 3) === 5)', [], 'allow', NC),
  mk('dev', 'neg-placeholders', 'Already-redacted placeholders', '[EMAIL_1] asked about [API_KEY_2]', [], 'allow', N),
  mk('heldout', 'neg-email-word', 'Mentions email without an address', 'Please email the finance team and ask for the invoice.', [], 'allow', N),
  mk('dev', 'neg-plain-prose', 'Harmless prose', 'Summarise the main differences between REST and GraphQL in three bullets.', [], 'allow', N),
  mk('heldout', 'neg-numbers', 'Numbers and measurements', 'The sensor logged 3.14159, 42, 1000000 and 0.0001 over 12 hours.', [], 'allow', N),
  mk('dev', 'neg-file-path', 'File paths and urls', 'See /usr/local/lib/node_modules and https://example.com/docs/getting-started.', [], 'allow', N),
  mk('heldout', 'neg-config-keys', 'Config key names without values', 'Set secret_key, auth_token and db_password in your vault, not in git.', [], 'allow', N),
]
