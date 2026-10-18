# Detector catalog

Generated from the code (core v1.0.0). Do not edit by hand; run `npm run docs:detectors`.

81 built-in deterministic detectors, plus the optional local name analyzer (`context.compromise-people`) and user-defined custom rules.
Each detector has synthetic positive and negative examples that are asserted in unit tests.

## email

Strict policy: **redact ≥ 0.6**. Permissive: **warn ≥ 0.6**.

| Detector | Version | Description |
|---|---|---|
| `pii.email` | 1.0.0 | Email addresses |

## phone

Strict policy: **redact ≥ 0.6**. Permissive: **warn ≥ 0.6**.

| Detector | Version | Description |
|---|---|---|
| `pii.phone` | 1.1.0 | Phone numbers: E.164, US, UK and Indian mobile formats |

## ip_address

Strict policy: **warn ≥ 0.6**. Permissive: **allow ≥ 0.6**.

| Detector | Version | Description |
|---|---|---|
| `pii.ipv4` | 1.0.0 | IPv4 addresses (octet-validated) |
| `pii.ipv6` | 1.0.0 | IPv6 addresses (full or compressed, structure-validated) |

## person_name

Strict policy: **redact ≥ 0.6**. Permissive: **warn ≥ 0.6**.

| Detector | Version | Description |
|---|---|---|
| `pii.labeled-name` | 1.1.0 | Person names introduced by an explicit label |

## gov_id

Strict policy: **redact (mandatory) ≥ 0.7**. Permissive: **warn ≥ 0.7**.

| Detector | Version | Description |
|---|---|---|
| `gov.us-ssn` | 1.1.0 | US Social Security Numbers |
| `gov.in-aadhaar` | 1.1.0 | Indian Aadhaar numbers (Verhoeff checksum) |
| `gov.in-pan` | 1.1.0 | Indian PAN (Permanent Account Number) |
| `gov.uk-nino` | 1.1.0 | UK National Insurance numbers |
| `gov.passport` | 1.0.0 | Passport numbers (label context required) |
| `gov.ca-sin` | 1.1.0 | Canadian Social Insurance Numbers (Luhn checksum) |
| `gov.au-tfn` | 1.1.0 | Australian Tax File Numbers (weighted mod-11 checksum) |
| `gov.br-cpf` | 1.1.0 | Brazilian CPF numbers (mod-11 check digits) |
| `gov.sg-nric` | 1.1.0 | Singapore NRIC / FIN (checksum letter) |
| `gov.es-dni` | 1.0.0 | Spanish DNI / NIE (mod-23 control letter) |
| `gov.in-voter-id` | 1.0.0 | Indian voter ID / EPIC numbers (label context required) |
| `gov.us-itin` | 1.0.0 | US Individual Taxpayer Identification Numbers |
| `gov.us-drivers-license` | 1.0.0 | Driver's licence numbers (label context required) |
| `gov.us-ein` | 1.0.0 | US Employer Identification Numbers (label context required) |

## financial

Strict policy: **redact (mandatory) ≥ 0.7**. Permissive: **warn ≥ 0.7**.

| Detector | Version | Description |
|---|---|---|
| `fin.card` | 1.1.0 | Payment card numbers (Luhn + issuer prefix) |
| `fin.iban` | 1.0.0 | IBANs (mod-97 validated) |
| `fin.bank-account` | 1.0.0 | Bank account / routing numbers (label context required) |

## health

Strict policy: **redact (mandatory) ≥ 0.7**. Permissive: **warn ≥ 0.7**.

| Detector | Version | Description |
|---|---|---|
| `health.mrn` | 1.0.0 | Medical record / patient / insurance identifiers (label required) |
| `health.condition` | 1.0.0 | Named diagnoses and conditions, reported only next to clinical context words |

## cloud_credential

Strict policy: **redact (mandatory) ≥ 0.7**. Permissive: **redact (mandatory) ≥ 0.75**.

| Detector | Version | Description |
|---|---|---|
| `secret.aws-access-key` | 1.0.0 | AWS access key ID (AKIA/ASIA/ABIA/ACCA prefix) |
| `secret.aws-access-key-embedded` | 1.0.0 | AWS access key ID embedded in a longer alphanumeric run (uncertain) |
| `secret.aws-secret-key` | 1.0.0 | 40-character AWS secret access key next to an AWS secret label |
| `secret.gcp-api-key` | 1.0.0 | Google Cloud API key (AIza prefix) |
| `secret.gcp-key-id` | 1.0.0 | private_key_id field of a GCP service-account JSON file |
| `secret.azure-storage-key` | 1.0.0 | Azure storage AccountKey or Service Bus SharedAccessKey in a connection string |
| `secret.stripe-key` | 1.0.0 | Stripe secret or restricted API key (live or test) |
| `secret.github-token` | 1.0.0 | GitHub personal/OAuth/app token or fine-grained PAT |
| `secret.gitlab-token` | 1.0.0 | GitLab personal access token |
| `secret.slack-token` | 1.0.0 | Slack token |
| `secret.slack-webhook` | 1.0.0 | Slack webhook URL |
| `secret.anthropic-key` | 1.0.0 | Anthropic API key |
| `secret.openai-key` | 1.0.0 | OpenAI API key |
| `secret.huggingface-token` | 1.0.0 | Hugging Face token |
| `secret.npm-token` | 1.0.0 | npm access token |
| `secret.sendgrid-key` | 1.0.0 | SendGrid API key |
| `secret.twilio-key` | 1.0.0 | Twilio API key SID |
| `secret.google-oauth-token` | 1.0.0 | Google OAuth access token |
| `secret.telegram-bot-token` | 1.0.0 | Telegram bot token |
| `secret.mailgun-key` | 1.0.0 | Mailgun API key |
| `secret.discord-webhook` | 1.0.0 | Discord webhook URL |
| `secret.shopify-token` | 1.0.0 | Shopify access token |
| `secret.digitalocean-token` | 1.0.0 | DigitalOcean token |
| `secret.doppler-token` | 1.0.0 | Doppler token |
| `secret.linear-key` | 1.0.0 | Linear API key |
| `secret.postman-key` | 1.0.0 | Postman API key |
| `secret.pypi-token` | 1.0.0 | PyPI upload token |
| `secret.databricks-token` | 1.0.0 | Databricks personal access token |
| `secret.notion-token` | 1.0.0 | Notion integration token |
| `secret.grafana-token` | 1.0.0 | Grafana Cloud token or service-account token |
| `secret.atlassian-token` | 1.0.0 | Atlassian API token |
| `secret.vault-token` | 1.0.0 | HashiCorp Vault token |
| `secret.terraform-cloud-token` | 1.0.0 | Terraform Cloud API token |
| `secret.mapbox-secret-token` | 1.0.0 | Mapbox secret access token |
| `secret.square-token` | 1.0.0 | Square access token |
| `secret.azure-ad-client-secret` | 1.0.0 | Azure AD client secret |
| `secret.supabase-key` | 1.0.0 | Supabase access token or secret API key |
| `secret.vercel-token` | 1.0.0 | Vercel token |
| `secret.flyio-token` | 1.0.0 | Fly.io access token |
| `secret.fcm-server-key` | 1.0.0 | Firebase Cloud Messaging server key |
| `secret.cloudflare-token` | 1.0.0 | Cloudflare API token next to a Cloudflare label |
| `secret.split-token` | 1.0.1 | Provider-prefixed token broken across a line break (optionally with indentation) |

## private_key

Strict policy: **block (mandatory) ≥ 0.7**. Permissive: **block (mandatory) ≥ 0.7**.

| Detector | Version | Description |
|---|---|---|
| `secret.age-secret-key` | 1.0.0 | age encryption secret key |
| `secret.private-key` | 1.0.0 | PEM-encoded private key blocks (RSA, EC, OpenSSH, PGP, PKCS#8, encrypted) |
| `secret.putty-key` | 1.0.0 | PuTTY private key file (.ppk) |

## credential

Strict policy: **redact (mandatory) ≥ 0.7**. Permissive: **redact (mandatory) ≥ 0.75**.

| Detector | Version | Description |
|---|---|---|
| `secret.jwt` | 1.0.0 | JSON Web Token (three base64url segments, header decoded and checked for "alg") |
| `secret.auth-header` | 1.0.0 | Authorization header credentials (Bearer / Basic tokens) |
| `secret.password-assignment` | 1.0.0 | Password assigned in code, JSON, YAML, env files or CLI flags |
| `secret.generic-assignment` | 1.0.0 | API key / secret / token style keys assigned a long value |
| `secret.prose-password` | 1.0.0 | Passwords or PINs disclosed in natural-language sentences |
| `secret.url-password` | 1.0.0 | Password embedded in a non-database URL (https://user:pass@host, ftp://...) |
| `secret.high-entropy` | 1.0.0 | Unlabeled high-entropy token (supporting evidence, low confidence) |

## crypto_seed

Strict policy: **block (mandatory) ≥ 0.7**. Permissive: **block (mandatory) ≥ 0.7**.

| Detector | Version | Description |
|---|---|---|
| `crypto.bip39-seed` | 1.0.0 | Runs of 12/15/18/21/24 lowercase BIP39 words (checksum-validated when possible) |
| `crypto.eth-private-key` | 1.0.0 | 64-hex-character wallet private key next to a private key label |

## db_connection

Strict policy: **redact (mandatory) ≥ 0.7**. Permissive: **redact (mandatory) ≥ 0.75**.

| Detector | Version | Description |
|---|---|---|
| `secret.db-uri` | 1.0.0 | Database connection URI containing a password (postgres, mysql, mongodb, redis, amqp, ...) |
| `secret.jdbc-url` | 1.0.0 | JDBC URL carrying a password parameter or embedded credentials |
| `secret.db-keyvalue` | 1.0.0 | ADO.NET / ODBC style connection string (Server=...;Password=...;) |
