/**
 * Synthetic fixtures only. Token-like strings are assembled from parts so that repository
 * secret scanners do not flag them.
 */
const lines = (n: number, tail: string): string[] => [
  ...Array.from({ length: n }, () => 'ZmFrZWtleW1hdGVyaWFs'.repeat(3) + 'ZmFr'),
  tail,
]

const pem = (label: string, bodyLines: string[]): string =>
  ['-----BEGIN ' + label + '-----', ...bodyLines, '-----END ' + label + '-----'].join('\n')

export const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
export const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/' + 'bPxRfiCYEXAMPLEKEY'
export const GH_TOKEN = 'gh' + 'p_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'
export const STRIPE_KEY = 'sk_' + 'live_' + '4eC39HqLyjWDarjtT1zdp7dc'
export const SLACK_TOKEN = 'xox' + 'b-' + '123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'
export const OPENAI_KEY = 'sk-' + 'proj-' + 'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz3Ab4Cd5Ef6'
export const GENERIC_API_KEY = 'k9Xq2Lm8Zr4Tv7Bn3Wc6Yd1Hs5Jf0Ga'
export const PASSWORD = 'S3cr3t!Passw0rd'
export const BEARER = 'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZg'
export const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
export const HIGH_ENTROPY = 'q8Zr4TvB7nWc6Yd1Hs5JfG0aKx9LmP2Ue3Vo8Ri'

export const PEM_RSA = pem('RSA PRIVATE ' + 'KEY', lines(3, 'ZmFrZWVuZA=='))
export const PEM_OPENSSH = pem('OPENSSH PRIVATE ' + 'KEY', lines(2, 'b3BlbnNzaA=='))
export const PEM_EC = pem('EC PRIVATE ' + 'KEY', lines(1, 'ZWNmYWtl'))

export const BIP39_A = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
export const BIP39_B = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'

export const DB_PG = 'postgres://admin:' + PASSWORD + '@db.example.com:5432/app'
export const DB_MONGO = 'mongodb+srv://svc_user:Mng0Pass99@cluster0.example.com/orders'
export const DB_MYSQL = 'mysql://root:rootpass123@mysql.example.com:3306/shop'
export const DB_REDIS = 'redis://default:r3d1sPass@cache.example.com:6379'

export const CARD_VISA = '4111111111111111'
export const CARD_MC = '5555555555554444'
export const CARD_AMEX = '378282246310005'
export const IBAN = 'GB82WEST12345698765432'
export const SSN = '123-45-6789'
export const AADHAAR = '2345 6789 0124'
export const PAN = 'ABCPE1234F'

// ---------- International gov IDs (checksum-valid, synthetic) ----------
export const SIN_CA = '130 692 544'
export const TFN_AU = '123 456 782'
export const CPF_BR = '529.982.247' + '-25'
export const NRIC_SG = 'S1234567' + 'D'
export const DNI_ES = '12345678' + 'Z'
export const ITIN_US = '912-70' + '-1234'

// ---------- Provider tokens (assembled from parts) ----------
const POOL = 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU1vW0xYzC'
const rep = (n: number, pool = POOL): string => Array.from({ length: n }, (_, i) => pool[(i * 7 + 3) % pool.length]).join('')
const HEXPOOL = '0123456789abcdef'
export const SHOPIFY_TOKEN = 'shp' + 'at_' + rep(32, HEXPOOL)
export const DO_TOKEN = 'do' + 'p_v1_' + rep(64, HEXPOOL)
export const LINEAR_KEY = 'lin_' + 'api_' + rep(40)
export const DATABRICKS_TOKEN = 'dap' + 'i' + rep(32, HEXPOOL)
export const VAULT_TOKEN = 'hv' + 's.' + rep(28)
export const SUPABASE_PAT = 'sb' + 'p_' + rep(40, HEXPOOL)
export const FLY_TOKEN = 'fo' + '1_' + rep(43)
export const NOTION_TOKEN = 'sec' + 'ret_' + rep(43)
export const AGE_KEY = 'AGE-SECRET' + '-KEY-1' + rep(58, 'QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L')
