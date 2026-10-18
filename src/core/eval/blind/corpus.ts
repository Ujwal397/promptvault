import { ex, mk, type EvalCase } from '../corpus/helpers'

export const BLIND_CORPUS_VERSION = '1.0.0'

// Token-like literals are assembled from parts so repo secret scanners do not flag this file.
const AWS_ID = 'AKIA' + 'Y3QZ7HD2M5TVNW4K'
const AWS_SECRET = 'q8Lw3Zr0TnV5xJ2mPcB7yHd1KfA9sGe4UoR6iXtN'
const GH_PAT = 'ghp_' + 'k3Jd8Fq2LmZ7vR1xW9tYb5NcH0sPa4UeG6oT'
const SLACK_BOT = 'xoxb-' + '2048117360-5190274835-' + 'Hq7ZpL3vN9cR2xT5wY8eK1dM'
const STRIPE_LIVE = 'sk_live_' + '51Hx9KdLm2QpR7vZ3nTb8WcY'
const OPENAI_KEY = 'sk-proj-' + 'Tq8vL2mZ9xR4nB7cK1wY5pHd3JfA6sGe0UoXiNtV8yQ2'
const GOOGLE_KEY = 'AIza' + 'SyD7k2Lm9ZqR4vXn1TbW8cYp3HdJfA6sGe0'
const NPM_TOKEN = 'npm_' + 'Rk4Zq9LmT2vXn7cB1wYp5HdJ3fA8sGe6UoNi'
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.' +
  'eyJzdWIiOiJ1c3JfODgyMTQiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE4OTM0NTYwMDB9' +
  '.' +
  'k7Qm2ZxR9vL4nT1cWb8YpHd3JfA6sGe0UoXiNtV5yQ2'
const PEM =
  '-----BEGIN ' + 'RSA PRIVATE KEY-----\n' +
  'MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu\n' +
  'KUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQJAIJLixBy2qpFoS4DSmoEm\n' +
  'o3qGy0t6z09AIJtH+5OeRV1be+N4cDYJKffGzDa88vQENZiRm0GRq6a+HPGQMd2k\n' +
  '-----END ' + 'RSA PRIVATE KEY-----'
const PG_URL = 'postgres://app_user:Tr0ub4dor' + '!x9@db-prod.internal.example.com:5432/orders'
const MONGO_URL = 'mongodb+srv://svc_reports:H7vQ2mZk9LpR@cluster0.ab1cd.example.net/analytics?retryWrites=true'
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const MISSING_NOTE = 'Does this look right?'

export const BLIND_CORPUS: EvalCase[] = [
  // ---------------- credentials (16) ----------------
  mk(
    'heldout',
    'blind-cred-01',
    'boto3 client with hardcoded AWS key pair',
    `Why am I getting AccessDenied here?\n\nimport boto3\ns3 = boto3.client(\n    "s3",\n    aws_access_key_id="${AWS_ID}",\n    aws_secret_access_key="${AWS_SECRET}",\n    region_name="us-east-1",\n)\ns3.list_objects_v2(Bucket="acme-uploads-staging")`,
    [ex('cloud_credential', AWS_ID), ex('cloud_credential', AWS_SECRET)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-02',
    'curl with GitHub PAT in auth header',
    `can you turn this into a node fetch call?\n\ncurl -s -H "Authorization: token ${GH_PAT}" \\\n  -H "Accept: application/vnd.github+json" \\\n  https://api.github.com/repos/example-org/billing-svc/issues?state=open`,
    [ex('cloud_credential', GH_PAT)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-03',
    'Slack bot token inside a JS config object',
    `const { App } = require('@slack/bolt');\n\nconst app = new App({\n  token: '${SLACK_BOT}',\n  signingSecret: process.env.SLACK_SIGNING_SECRET,\n});\n\n// bot never replies in threads, what am I missing?`,
    [ex('cloud_credential', SLACK_BOT)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-04',
    '.env file with live Stripe key and app secret',
    `my .env, is anything wrong with the format?\n\nNODE_ENV=production\nPORT=8080\nSTRIPE_SECRET_KEY=${STRIPE_LIVE}\nSESSION_PASSWORD=Gx7!pQ2vLz9#Rm4w\nLOG_LEVEL=info`,
    [ex('cloud_credential', STRIPE_LIVE), ex('credential', 'Gx7!pQ2vLz9#Rm4w')],
    'redact',
    ['code', 'mixed'],
  ),
  mk(
    'heldout',
    'blind-cred-05',
    'OpenAI key hardcoded in python script',
    `from openai import OpenAI\n\nclient = OpenAI(api_key="${OPENAI_KEY}")\nresp = client.chat.completions.create(\n    model="gpt-4o-mini",\n    messages=[{"role": "user", "content": "summarize this"}],\n)\nprint(resp.choices[0].message.content)\n\nThis returns 429 even though I just created the key.`,
    [ex('cloud_credential', OPENAI_KEY)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-06',
    'Google Maps key in a URL inside JS',
    `async function geocode(addr) {\n  const url = \`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(addr)}&key=${GOOGLE_KEY}\`;\n  const r = await fetch(url);\n  return (await r.json()).results[0];\n}\n// REQUEST_DENIED, why?`,
    [ex('cloud_credential', GOOGLE_KEY)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-07',
    'PEM RSA private key pasted for debugging',
    `openssl says "bad decrypt" when I load this. Here is the file:\n\n${PEM}\n\nI generated it with ssh-keygen -m PEM last week.`,
    [ex('private_key', PEM)],
    'block',
    ['positive'],
  ),
  mk(
    'heldout',
    'blind-cred-08',
    'Go sql.Open with Postgres URL containing password',
    `package main\n\nimport (\n\t"database/sql"\n\t_ "github.com/lib/pq"\n)\n\nfunc main() {\n\tdb, err := sql.Open("postgres", "${PG_URL}")\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer db.Close()\n}\n\nconnection hangs on the first query`,
    [ex('db_connection', PG_URL)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-09',
    'JWT in a bearer header inside an error message',
    `Getting this from our gateway, what does it mean?\n\n[2026-09-30T11:04:22Z] ERROR gateway: 401 Unauthorized\n  request: GET /v2/accounts/me\n  Authorization: Bearer ${JWT}\n  reason: token signature mismatch`,
    [ex('credential', JWT)],
    'redact',
    ['positive'],
  ),
  mk(
    'heldout',
    'blind-cred-10',
    'docker-compose YAML with DB password',
    `services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: reports\n      POSTGRES_PASSWORD: Wq9#mTz2vLx8Kd4p\n      POSTGRES_DB: reports\n    ports:\n      - "5432:5432"\n\nhow do I make it persist data across restarts?`,
    [ex('credential', 'Wq9#mTz2vLx8Kd4p')],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-11',
    'Kubernetes Secret manifest with base64 password',
    `apiVersion: v1\nkind: Secret\nmetadata:\n  name: api-db-creds\n  namespace: payments\ntype: Opaque\ndata:\n  username: YXBpX3VzZXI=\n  password: UzNjcjN0UGFzcyEyMDI2eHk=\n\nIs there a way to template this with helm without committing the values?`,
    [ex('credential', 'UzNjcjN0UGFzcyEyMDI2eHk=')],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-12',
    'Terraform provider block with AWS keys',
    `provider "aws" {\n  region     = "eu-west-2"\n  access_key = "${AWS_ID}"\n  secret_key = "${AWS_SECRET}"\n}\n\nresource "aws_s3_bucket" "logs" {\n  bucket = "acme-logs-prod"\n}\n\nterraform plan says "InvalidClientTokenId"`,
    [ex('cloud_credential', AWS_ID), ex('cloud_credential', AWS_SECRET)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-13',
    'Stack trace leaking a MongoDB SRV URI',
    `Traceback (most recent call last):\n  File "/srv/app/db.py", line 14, in connect\n    client = MongoClient("${MONGO_URL}")\n  File "/usr/lib/python3.11/site-packages/pymongo/mongo_client.py", line 772, in __init__\npymongo.errors.ServerSelectionTimeoutError: cluster0.ab1cd.example.net:27017: timed out`,
    [ex('db_connection', MONGO_URL)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-14',
    'CI log line printing an npm token',
    `Run npm publish\nnpm notice\nnpm notice package: @acme/ui-kit@3.4.1\nnpm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}\nnpm ERR! code E403\nnpm ERR! 403 Forbidden - PUT https://registry.npmjs.org/@acme%2fui-kit\n\nwhy is publish forbidden?`,
    [ex('cloud_credential', NPM_TOKEN)],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-15',
    'Dockerfile with ENV password',
    `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nENV ADMIN_USER=admin\nENV ADMIN_PASSWORD=Bl4ckB0x!Winter26\nCOPY . .\nCMD ["node", "server.js"]\n\nhow do I shrink this image?`,
    [ex('credential', 'Bl4ckB0x!Winter26')],
    'redact',
    ['code', 'positive'],
  ),
  mk(
    'heldout',
    'blind-cred-16',
    'Shell history with mysql password flag and export',
    `  412  export DB_PASS='Jx5!kQ8zWm2Lp9Rv'\n  413  mysql -h db1.example.com -u root -pJx5!kQ8zWm2Lp9Rv shop < dump.sql\n  414  history | tail\n\ndid I just leak my password into my shell history? how do I clear it`,
    [ex('credential', 'Jx5!kQ8zWm2Lp9Rv', 1), ex('credential', 'Jx5!kQ8zWm2Lp9Rv', 2)],
    'redact',
    ['code', 'positive'],
  ),

  // ---------------- PII (12) ----------------
  mk(
    'heldout',
    'blind-pii-01',
    'Support ticket with name, email and US phone',
    `Ticket #48213\nCustomer: Marcus Whitfield\nEmail: marcus.whitfield@example.com\nPhone: (415) 555-0142\n\nHe says his order never shipped and wants a refund. Draft a polite reply that apologizes and offers store credit.`,
    [
      ex('person_name', 'Marcus Whitfield'),
      ex('email', 'marcus.whitfield@example.com'),
      ex('phone', '(415) 555-0142'),
    ],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-02',
    'HR email about an employee with SSN',
    `Hi team,\n\nPlease update payroll for Priya Raman (employee since 2021). Her SSN on the W-4 is 219-09-9999 and she is moving to the Austin office on Nov 1.\n\nCan you rewrite this so it sounds less abrupt?`,
    [ex('person_name', 'Priya Raman'), ex('gov_id', '219-09-9999')],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-03',
    'Clinical note with patient name and diagnosis',
    `Summarize this for the discharge letter:\n\nPatient: Eleanor Voss, 67F. Admitted with chest pain. History of Type 2 diabetes mellitus and hypertension. Started on metformin 500 mg BID. Follow up with cardiology in 2 weeks.`,
    [ex('person_name', 'Eleanor Voss'), ex('health', 'Type 2 diabetes mellitus')],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-04',
    'CRM export CSV with UK mobile numbers',
    `name,email,phone,plan\nOliver Hartley,oliver.hartley@example.co.uk,+44 7700 900123,pro\nAmelia Brooks,a.brooks@example.co.uk,07700 900456,free\n\nwrite a pandas snippet that dedupes by email`,
    [
      ex('person_name', 'Oliver Hartley'),
      ex('email', 'oliver.hartley@example.co.uk'),
      ex('phone', '+44 7700 900123'),
      ex('person_name', 'Amelia Brooks'),
      ex('email', 'a.brooks@example.co.uk'),
      ex('phone', '07700 900456'),
    ],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-05',
    'Indian customer with phone and Aadhaar number',
    `KYC form received from Rohan Mehta.\nMobile: +91 98765 43210\nAadhaar: 2345 6789 0123\n\nExtract these into JSON for the onboarding API.`,
    [ex('person_name', 'Rohan Mehta'), ex('phone', '+91 98765 43210'), ex('gov_id', '2345 6789 0123')],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-06',
    'Refund request containing a test Visa number',
    `Customer wants a chargeback reversed. Card used was 4111 1111 1111 1111, exp 08/28, billed to Dana Okafor. Write a short note to the bank.`,
    [ex('financial', '4111 1111 1111 1111'), ex('person_name', 'Dana Okafor')],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-07',
    'Vendor onboarding with IBAN',
    `Please set up the new supplier. Bank details:\n\nAccount holder: Northwind Logistics GmbH\nIBAN: GB82WEST12345698765432\nContact: Lena Fischer, lena.fischer@example.com\n\nDoes this meet the minimum fields for our ERP?`,
    [
      ex('financial', 'GB82WEST12345698765432'),
      ex('person_name', 'Lena Fischer'),
      ex('email', 'lena.fischer@example.com'),
    ],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-08',
    'Shipping label details with name and phone',
    `Shipping label draft:\n\nTo: Tomasz Kowalski\n1428 Elmwood Ave, Apt 9\nSpringfield, IL 62704\nTel 217-555-0188\n\nformat this as a two column table`,
    [ex('person_name', 'Tomasz Kowalski'), ex('phone', '217-555-0188')],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-09',
    'Mailing list rows with emails only',
    `beta signups from last night:\njules@example.com\nsam.rivera@example.org\nnadia_k99@example.net\n\nwrite a mail merge template`,
    [
      ex('email', 'jules@example.com'),
      ex('email', 'sam.rivera@example.org'),
      ex('email', 'nadia_k99@example.net'),
    ],
    'redact',
    ['positive'],
  ),
  mk(
    'heldout',
    'blind-pii-10',
    'Invoice dispute with Mastercard test number',
    `From: billing@example.com\nSubject: Duplicate charge\n\nHello, I was charged twice on my Mastercard 5555 5555 5555 4444. My name is Imani Joseph. Please fix.\n\nsummarize and classify urgency`,
    [
      ex('email', 'billing@example.com'),
      ex('financial', '5555 5555 5555 4444'),
      ex('person_name', 'Imani Joseph'),
    ],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-11',
    'UK candidate profile with National Insurance number',
    `Right-to-work check for candidate Harriet Linden. NI number: QQ 12 34 56 C. Passport verified. Write an onboarding checklist email.`,
    [ex('person_name', 'Harriet Linden'), ex('gov_id', 'QQ 12 34 56 C')],
    'redact',
    ['mixed'],
  ),
  mk(
    'heldout',
    'blind-pii-12',
    'Meeting notes with email and public IP',
    `Notes from the incident call:\n- Attacker traffic came from 203.0.113.42\n- Escalate to ciso.office@example.com\n- Block range at the edge\n\nturn this into a postmortem summary`,
    [ex('ip_address', '203.0.113.42'), ex('email', 'ciso.office@example.com')],
    'redact',
    ['mixed'],
  ),

  // ---------------- negatives / tricky (12) ----------------
  mk(
    'heldout',
    'blind-neg-01',
    'Code reading keys from env without any values',
    `import os\n\napi_key = os.environ["OPENAI_API_KEY"]\nsecret = os.getenv("STRIPE_SECRET_KEY")\nif not api_key:\n    raise RuntimeError("OPENAI_API_KEY is not set")\n\nhow do I load these from a .env file?`,
    [],
    'allow',
    ['negative', 'code'],
  ),
  mk(
    'heldout',
    'blind-neg-02',
    'Docs with obviously placeholder keys',
    `To authenticate, send your key in the Authorization header:\n\n  Authorization: Bearer <YOUR_API_KEY>\n\nOpenAI keys look like sk-xxxxxxxxxxxxxxxx. Replace YOUR_TOKEN_HERE with the token from the dashboard. ${MISSING_NOTE}`,
    [],
    'allow',
    ['negative'],
  ),
  mk(
    'heldout',
    'blind-neg-03',
    'Lorem ipsum filler text',
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. Make this sound more professional.`,
    [],
    'allow',
    ['negative'],
  ),
  mk(
    'heldout',
    'blind-neg-04',
    'Math with long numbers',
    `Compute 12345678901234567890 mod 97, then verify that 2^64 = 18446744073709551616 and that pi is roughly 3.14159265358979323846. Show your steps.`,
    [],
    'allow',
    ['negative'],
  ),
  mk(
    'heldout',
    'blind-neg-05',
    'Git commit hashes',
    `git log --oneline\n3f2a9c1e8b7d4a6f5c0e1d2b3a4958677e8d9f0a Fix flaky retry test\n9b1c7e5d3a2f4e6c8d0b1a29384756cdef012345 Bump deps\n\nwhich of these should I revert to undo the retry change?`,
    [],
    'allow',
    ['negative', 'code'],
  ),
  mk(
    'heldout',
    'blind-neg-06',
    'UUIDs in JSON',
    `{\n  "id": "b7e2c3a4-5d6f-4a8b-9c0d-1e2f3a4b5c6d",\n  "parent": "0f8fad5b-d9cb-469f-a165-70867728950e",\n  "status": "active"\n}\n\nwrite a zod schema for this`,
    [],
    'allow',
    ['negative', 'code'],
  ),
  mk(
    'heldout',
    'blind-neg-07',
    'Base64 image data URI',
    `<img alt="dot" src="data:image/png;base64,${PNG_B64}" />\n\nwhy does this render as a tiny dot?`,
    [],
    'allow',
    ['negative', 'code'],
  ),
  mk(
    'heldout',
    'blind-neg-08',
    'Hex dump of a binary header',
    `00000000  7f 45 4c 46 02 01 01 00  00 00 00 00 00 00 00 00  |.ELF............|\n00000010  03 00 3e 00 01 00 00 00  40 10 00 00 00 00 00 00  |..>.....@.......|\n\nwhat is this file format?`,
    [],
    'allow',
    ['negative'],
  ),
  mk(
    'heldout',
    'blind-neg-09',
    'Public BTC and ETH addresses (not secrets)',
    `Donation addresses for the project:\nBTC: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq\nETH: 0x71C7656EC7ab88b098defB751B7401B5f6d8976F\n\nformat these nicely for the README`,
    [],
    'allow',
    ['negative', 'adversarial'],
  ),
  mk(
    'heldout',
    'blind-neg-10',
    'Access log lines with request IDs',
    `2026-10-02T08:14:31Z INFO req_id=8c1f4a2e7b9d4036 method=GET path=/health status=200 dur=3ms\n2026-10-02T08:14:32Z INFO req_id=1d93be07a4c85f62 method=POST path=/orders status=201 dur=48ms\n2026-10-02T08:14:35Z WARN req_id=5e60c9d1f3a2b784 method=POST path=/orders status=429 dur=1ms\n\nwhy the 429?`,
    [],
    'allow',
    ['negative'],
  ),
  mk(
    'heldout',
    'blind-neg-11',
    'The word password used in prose',
    `I forgot my password again and the reset link expired. Our policy says a password must be at least 12 characters and never reused. Can you write a friendly help center article about choosing a good password?`,
    [],
    'allow',
    ['negative'],
  ),
  mk(
    'heldout',
    'blind-neg-12',
    'Config mentioning a documentation-range public IP',
    `upstream backend {\n    server 198.51.100.23:8080;\n}\n\nnginx returns 502 for this upstream, what should I check?`,
    [ex('ip_address', '198.51.100.23')],
    'warn',
    ['code', 'positive'],
  ),
]
