import * as F from './fixtures'
import { ex, mk, type EvalCase } from './helpers'

const ZW = '​'
const A: ['positive', 'adversarial'] = ['positive', 'adversarial']
const AC: ['positive', 'adversarial', 'code'] = ['positive', 'adversarial', 'code']

/** AWS key with a zero-width space inside, as it appears in the text. */
const ZW_AWS = `AKIA${ZW}IOSFODNN7EXAMPLE`
const ZW_EMAIL = `jane.doe${ZW}@example.com`

export const ADVERSARIAL_CASES: EvalCase[] = [
  mk('dev', 'adv-zw-aws', 'Zero-width space inside an AWS key',
    `my key is ${ZW_AWS} please check`,
    [ex('cloud_credential', ZW_AWS)], 'redact', A),
  mk('dev', 'adv-zw-email', 'Zero-width space inside an email',
    `Contact ${ZW_EMAIL} for details`,
    [ex('email', ZW_EMAIL)], 'redact', A),
  mk('dev', 'adv-repeat-aws', 'Same AWS key twice',
    `First ${F.AWS_KEY} then again ${F.AWS_KEY}`,
    [ex('cloud_credential', F.AWS_KEY, 1), ex('cloud_credential', F.AWS_KEY, 2)], 'redact', A),
  mk('heldout', 'adv-repeat-email', 'Same email three times',
    'a@example.com wrote to a@example.com and copied a@example.com',
    [ex('email', 'a@example.com', 1), ex('email', 'a@example.com', 2), ex('email', 'a@example.com', 3)], 'redact', A),
  mk('dev', 'adv-json', 'Secrets in a JSON body',
    `{"user": "svc", "password": "${F.PASSWORD}", "apiKey": "${F.OPENAI_KEY}"}`,
    [ex('credential', F.PASSWORD), ex('cloud_credential', F.OPENAI_KEY)], 'redact', AC),
  mk('dev', 'adv-yaml', 'Connection string in YAML',
    `database:\n  url: ${F.DB_PG}\n  pool: 5\n`,
    [ex('db_connection', F.DB_PG)], 'redact', AC),
  mk('heldout', 'adv-dotenv', 'Secrets in a .env file',
    `AWS_ACCESS_KEY_ID=${F.AWS_KEY}\nAWS_SECRET_ACCESS_KEY=${F.AWS_SECRET}\nSTRIPE_KEY=${F.STRIPE_KEY}\nDEBUG=true`,
    [ex('cloud_credential', F.AWS_KEY), ex('cloud_credential', F.AWS_SECRET), ex('cloud_credential', F.STRIPE_KEY)], 'redact', AC),
  mk('dev', 'adv-python', 'Hardcoded key in Python',
    `import requests\nTOKEN = "${F.GH_TOKEN}"\nr = requests.get("https://api.example.com/user", headers={"Authorization": "token " + TOKEN})`,
    [ex('cloud_credential', F.GH_TOKEN)], 'redact', AC),
  mk('heldout', 'adv-js', 'Hardcoded Slack token in JS',
    `const client = new WebClient('${F.SLACK_TOKEN}');\nawait client.chat.postMessage({ channel: '#ops', text: 'hi' });`,
    [ex('cloud_credential', F.SLACK_TOKEN)], 'redact', AC),
  mk('dev', 'adv-log-line', 'Log line with bearer token and email',
    `2025-03-02T10:15:30Z INFO auth user=ops@example.com header="Authorization: Bearer ${F.BEARER}" status=200`,
    [ex('email', 'ops@example.com'), ex('credential', F.BEARER)], 'redact', A),
  mk('heldout', 'adv-stack-trace', 'DB URI inside a stack trace',
    `Error: connect ECONNREFUSED\n    at Pool.connect (/app/node_modules/pg/lib/pool.js:41:11)\n    at connect(${F.DB_MYSQL})\n    at main (/app/src/index.js:9:3)`,
    [ex('db_connection', F.DB_MYSQL)], 'redact', AC),
  mk('dev', 'adv-split-linebreak', 'AWS key split by a line break',
    'key: AKIAIOSFODNN7\nEXAMPLE',
    [ex('cloud_credential', 'AKIAIOSFODNN7\nEXAMPLE')], 'redact', A),
  {
    ...mk('dev', 'adv-high-entropy', 'Unlabeled high-entropy token, low confidence only',
      `Use this one: ${F.HIGH_ENTROPY}`,
      [], 'review', ['adversarial']),
    acceptable: [ex('credential', F.HIGH_ENTROPY)],
  },
  mk('heldout', 'adv-zw-only', 'Zero-width characters in otherwise plain text',
    `Please summarise${ZW} this${ZW} document${'⁠'} for me.`,
    [], 'warn', ['adversarial']),
]
