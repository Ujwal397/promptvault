import * as F from './fixtures'
import { ex, mk, type EvalCase } from './helpers'

const M: ['positive', 'mixed'] = ['positive', 'mixed']
const MC: ['positive', 'mixed', 'code'] = ['positive', 'mixed', 'code']

export const MIXED_CASES: EvalCase[] = [
  mk('dev', 'mix-prd-demo', 'PRD demo: code with API key and DB password',
    `import openai\nclient = openai.OpenAI(api_key="${F.OPENAI_KEY}")\nDB_PASSWORD = "${F.PASSWORD}"\n# why does the query time out?`,
    [ex('cloud_credential', F.OPENAI_KEY), ex('credential', F.PASSWORD)], 'redact', MC),
  mk('dev', 'mix-customer-record', 'Customer record with email, phone, card',
    `Customer: Name: Jane Doe\nEmail: jane.doe@example.com\nPhone: (415) 555-0132\nCard: 4111 1111 1111 1111`,
    [ex('person_name', 'Jane Doe'), ex('email', 'jane.doe@example.com'), ex('phone', '(415) 555-0132'), ex('financial', '4111 1111 1111 1111')],
    'redact', M),
  mk('dev', 'mix-support-ticket', 'Support ticket with name, SSN, MRN',
    `Ticket 88: Name: Priya Raman called about claim.\nSSN: ${F.SSN}\nPatient MRN: 00123456`,
    [ex('person_name', 'Priya Raman'), ex('gov_id', F.SSN), ex('health', '00123456')], 'redact', M),
  mk('dev', 'mix-key-and-email', 'PEM key together with an email',
    `From ops@example.com:\n${F.PEM_RSA}\nplease rotate it`,
    [ex('email', 'ops@example.com'), ex('private_key', F.PEM_RSA)], 'block', M),
  mk('heldout', 'mix-seed-ip', 'Seed phrase with an IP address',
    `Wallet host 192.0.2.77 uses seed phrase: ${F.BIP39_A}`,
    [ex('ip_address', '192.0.2.77'), ex('crypto_seed', F.BIP39_A)], 'block', M),
  mk('dev', 'mix-log-ip-email', 'Log with IP, email and bearer token',
    `10:01 request from 198.51.100.23 user=dev@example.com Authorization: Bearer ${F.BEARER}`,
    [ex('ip_address', '198.51.100.23'), ex('email', 'dev@example.com'), ex('credential', F.BEARER)], 'redact', M),
  mk('heldout', 'mix-aws-ip', 'AWS pair plus server IP',
    `ssh ec2-user@203.0.113.9\nexport AWS_ACCESS_KEY_ID=${F.AWS_KEY}\nexport AWS_SECRET_ACCESS_KEY=${F.AWS_SECRET}`,
    [ex('ip_address', '203.0.113.9'), ex('cloud_credential', F.AWS_KEY), ex('cloud_credential', F.AWS_SECRET)], 'redact', MC),
  mk('heldout', 'mix-hr-record', 'HR record with name, Aadhaar, PAN, IBAN',
    `Employee name: Arjun Mehta\nAadhaar: ${F.AADHAAR}\nPAN: ${F.PAN}\nSalary account IBAN ${F.IBAN}`,
    [ex('person_name', 'Arjun Mehta'), ex('gov_id', F.AADHAAR), ex('gov_id', F.PAN), ex('financial', F.IBAN)], 'redact', M),
  mk('dev', 'mix-db-gh-email', 'DB URI, GitHub token and email',
    `Deploy script for dev@example.com:\nDATABASE_URL=${F.DB_MONGO}\nGH_TOKEN=${F.GH_TOKEN}`,
    [ex('email', 'dev@example.com'), ex('db_connection', F.DB_MONGO), ex('cloud_credential', F.GH_TOKEN)], 'redact', MC),
  mk('heldout', 'mix-clean-with-ip', 'Benign text with one IP only',
    'Version 2.3.1 is deployed on 192.0.2.10; commit 9fceb02d0ae598e95dc970b74767f19372d61af8 passed CI.',
    [ex('ip_address', '192.0.2.10')], 'warn', M),
]
