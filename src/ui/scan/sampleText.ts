/**
 * Synthetic demo prompt from the approved "Check before you send" mockup.
 * Token-like values are assembled from parts, so this file contains no literal secret-shaped string.
 */
const DEMO_API_KEY = ['sk', 'demo', '4c1e7b20a9d34f6e8b59f2a'].join('-')
const DEMO_CONNECTION = ['postgres://admin:', 'Hunter2-demo', '@db.internal.example:5432/customers'].join('')

export const SAMPLE_PROMPT = [
  "Hi, I'm debugging our signup service. Priya from the platform team asked me to check why logins fail.",
  '',
  `Connection string: ${DEMO_CONNECTION}`,
  '',
  'Error from the logs:',
  '[2026-10-18 14:22:11] ERROR auth failed for priya.sharma@example.com',
  '',
  `Our API key is ${DEMO_API_KEY}, can you tell me what's wrong?`,
].join('\n')
