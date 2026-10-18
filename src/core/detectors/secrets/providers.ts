import type { Detector } from '../../types'
import { B64, B64URL, fake, hasMinEntropy, patternDetector } from './helpers'
import { provider } from './tokens'

const HEX = '0123456789abcdef'
const AZURE_SET = B64URL + '~.'
const AGE_SET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const shopify = provider(
  'secret.shopify-token', 'Shopify access token', 'SHOPIFY_TOKEN',
  /(?<![A-Za-z0-9_])shp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}(?![A-Za-z0-9])/g, 0.95,
  { positive: ['X-Shopify-Access-Token: shp' + 'at_' + fake(32, 50, HEX)], negative: ['shpat_short', 'xshpat_' + fake(32, 51, HEX), 'shpzz_' + fake(32, 52, HEX)] },
)

const digitalocean = provider(
  'secret.digitalocean-token', 'DigitalOcean token', 'DO_TOKEN',
  /(?<![A-Za-z0-9_])do[opr]_v1_[a-f0-9]{64}(?![A-Za-z0-9])/g, 0.95,
  { positive: ['DO_TOKEN=do' + 'p_v1_' + fake(64, 53, HEX)], negative: ['dop_v1_short', 'dox_v1_' + fake(64, 54, HEX)] },
)

const doppler = provider(
  'secret.doppler-token', 'Doppler token', 'DOPPLER_TOKEN',
  /(?<![A-Za-z0-9_])dp\.(?:pt|st|sa|ct|scim|audit)\.[A-Za-z0-9]{40,44}(?![A-Za-z0-9])/g, 0.95,
  { positive: ['DOPPLER_TOKEN=dp.' + 'st.' + fake(42, 55)], negative: ['dp.st.short', 'dp.xx.' + fake(42, 56)] },
)

const linear = provider(
  'secret.linear-key', 'Linear API key', 'LINEAR_KEY',
  /(?<![A-Za-z0-9_])lin_api_[A-Za-z0-9]{40}(?![A-Za-z0-9])/g, 0.95,
  { positive: ['Authorization: lin_' + 'api_' + fake(40, 57)], negative: ['lin_api_short', 'xlin_api_' + fake(40, 58)] },
)

const postman = provider(
  'secret.postman-key', 'Postman API key', 'POSTMAN_KEY',
  /(?<![A-Za-z0-9_-])PMAK-[a-f0-9]{24}-[a-f0-9]{34}(?![A-Za-z0-9])/g, 0.95,
  { positive: ['X-Api-Key: PMAK' + '-' + fake(24, 59, HEX) + '-' + fake(34, 60, HEX)], negative: ['PMAK-short-key', 'PMAK-' + fake(24, 61, HEX)] },
)

const pypi = provider(
  'secret.pypi-token', 'PyPI upload token', 'PYPI_TOKEN',
  /(?<![A-Za-z0-9_-])pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,500}/g, 0.95,
  { positive: ['password = pypi-' + 'AgEIcHlwaS5vcmc' + fake(70, 62, B64URL)], negative: ['pypi-AgEIcHlwaS5vcmc', 'pypi-package-index', 'pypi-AgEIcHlwaS5vcmc' + fake(10, 63)] },
)

const databricks = provider(
  'secret.databricks-token', 'Databricks personal access token', 'DATABRICKS_TOKEN',
  /(?<![A-Za-z0-9_])dapi[a-f0-9]{32}(?:-\d)?(?![A-Za-z0-9])/g, 0.95,
  { positive: ['DATABRICKS_TOKEN=dapi' + fake(32, 64, HEX), 'dapi' + fake(32, 65, HEX) + '-2'], negative: ['dapi' + fake(20, 66, HEX), 'xdapi' + fake(32, 67, HEX)] },
)

const notion = patternDetector({
  id: 'secret.notion-token',
  category: 'cloud_credential',
  description: 'Notion integration token',
  examples: {
    positive: ['NOTION_TOKEN=sec' + 'ret_' + fake(43, 68), 'nt' + 'n_' + fake(46, 69)],
    negative: ['secret_short', 'my_secret_' + fake(43, 70), 'ntn_' + fake(20, 71)],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9_])secret_[A-Za-z0-9]{43}(?![A-Za-z0-9])/g,
      label: 'Notion integration token', placeholder: 'NOTION_TOKEN',
      explanation: 'Matches the format of a Notion integration token (secret_ prefix, 43 characters).',
      confidence: 0.95, severity: 'critical', accept: hasMinEntropy(3.2),
    },
    {
      re: /(?<![A-Za-z0-9_])ntn_[A-Za-z0-9]{46}(?![A-Za-z0-9])/g,
      label: 'Notion integration token', placeholder: 'NOTION_TOKEN',
      explanation: 'Matches the format of a Notion integration token (ntn_ prefix, 50 characters).',
      confidence: 0.95, severity: 'critical',
    },
  ],
})

const grafana = patternDetector({
  id: 'secret.grafana-token',
  category: 'cloud_credential',
  description: 'Grafana Cloud token or service-account token',
  examples: {
    positive: ['GRAFANA_TOKEN=gl' + 'c_' + fake(60, 72, B64), 'gl' + 'sa_' + fake(32, 73) + '_' + fake(8, 74, HEX)],
    negative: ['glc_short', 'glsa_' + fake(32, 75), 'xglc_' + fake(60, 76)],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9_])glc_[A-Za-z0-9+/]{32,400}={0,2}/g,
      label: 'Grafana Cloud token', placeholder: 'GRAFANA_TOKEN',
      explanation: 'Matches the format of a Grafana Cloud token (glc_ prefix).',
      confidence: 0.95, severity: 'critical',
    },
    {
      re: /(?<![A-Za-z0-9_])glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8}(?![A-Za-z0-9])/g,
      label: 'Grafana service-account token', placeholder: 'GRAFANA_TOKEN',
      explanation: 'Matches the format of a Grafana service-account token (glsa_ prefix).',
      confidence: 0.95, severity: 'critical',
    },
  ],
})

const atlassian = provider(
  'secret.atlassian-token', 'Atlassian API token', 'ATLASSIAN_TOKEN',
  /(?<![A-Za-z0-9_])ATATT3[A-Za-z0-9_\-=]{186}(?![A-Za-z0-9_=-])/g, 0.95,
  { positive: ['JIRA_TOKEN=ATA' + 'TT3' + fake(186, 77, B64URL)], negative: ['ATATT3short', 'ATATT3' + fake(100, 78, B64URL)] },
)

const vault = provider(
  'secret.vault-token', 'HashiCorp Vault token', 'VAULT_TOKEN',
  /(?<![A-Za-z0-9_])hv[sbr]\.[A-Za-z0-9_-]{24,300}/g, 0.95,
  { positive: ['VAULT_TOKEN=hv' + 's.' + fake(24, 79, B64URL), 'hv' + 'b.' + fake(90, 80, B64URL)], negative: ['hvs.short', 'hvx.' + fake(30, 81), 'xhvs.' + fake(30, 82)] },
)

const terraform = provider(
  'secret.terraform-cloud-token', 'Terraform Cloud API token', 'TERRAFORM_TOKEN',
  /(?<![A-Za-z0-9_-])[A-Za-z0-9]{14}\.atlasv1\.[A-Za-z0-9_-]{60,70}(?![A-Za-z0-9_-])/g, 0.95,
  { positive: ['token = "' + fake(14, 83) + '.atlas' + 'v1.' + fake(65, 84, B64URL) + '"'], negative: ['abc.atlasv1.short', fake(14, 85) + '.atlasv1.' + fake(20, 86)] },
)

const mapbox = provider(
  'secret.mapbox-secret-token', 'Mapbox secret access token', 'MAPBOX_TOKEN',
  /(?<![A-Za-z0-9_-])sk\.eyJ[A-Za-z0-9_-]{50,500}\.[A-Za-z0-9_-]{20,100}(?![A-Za-z0-9_-])/g, 0.95,
  { positive: ['MAPBOX_SECRET=sk.' + 'eyJ' + fake(60, 87, B64URL) + '.' + fake(22, 88, B64URL)], negative: ['sk.eyJshort.tail', 'pk.eyJ' + fake(60, 89, B64URL) + '.' + fake(22, 90, B64URL)] },
)

const square = provider(
  'secret.square-token', 'Square access token', 'SQUARE_TOKEN',
  /(?<![A-Za-z0-9_-])(?:EAAA|sq0atp-|sq0csp-)[A-Za-z0-9_-]{22,60}(?![A-Za-z0-9_-])/g, 0.95,
  { positive: ['SQUARE_TOKEN=EA' + 'AA' + fake(40, 91, B64URL), 'sq0' + 'atp-' + fake(22, 92, B64URL)], negative: ['EAAAshort', 'xEAAA' + fake(40, 93), 'EAAA' + 'A'.repeat(30)] },
  { accept: hasMinEntropy(3) },
)

const cloudflare = patternDetector({
  id: 'secret.cloudflare-token',
  category: 'cloud_credential',
  description: 'Cloudflare API token next to a Cloudflare label',
  examples: {
    positive: ['CF_API_TOKEN=' + fake(40, 94, B64URL), 'cloudflare api token: "' + fake(40, 95, B64URL) + '"'],
    negative: ['CF_API_TOKEN=short', 'CF_API_TOKEN=' + 'A'.repeat(40), 'api token: ' + fake(40, 96, B64URL)],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9])(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN|cloudflare[ _-]{0,2}(?:api[ _-]{0,2})?(?:token|key))["']?[ \t]{0,3}[:=][ \t]{0,3}["']?([A-Za-z0-9_-]{40})(?![A-Za-z0-9_-])/dgi,
      group: 1, label: 'Cloudflare API token', placeholder: 'CLOUDFLARE_TOKEN', reasonCode: 'LABEL_CONTEXT',
      explanation: 'A 40-character token-like value follows a Cloudflare API token label.',
      confidence: 0.9, severity: 'critical', accept: hasMinEntropy(3.5),
    },
  ],
})

const azureAd = provider(
  'secret.azure-ad-client-secret', 'Azure AD client secret', 'AZURE_SECRET',
  /(?<![A-Za-z0-9_~.-])[A-Za-z0-9_~.-]{3}[78]Q~[A-Za-z0-9_~.-]{31,34}(?![A-Za-z0-9_~.-])/g, 0.92,
  { positive: ['AZURE_CLIENT_SECRET=' + fake(3, 97) + '8Q~' + fake(34, 98, AZURE_SET), 'client_secret: ' + fake(3, 99) + '8Q~' + fake(31, 100, AZURE_SET)], negative: ['abc8Q~short', fake(3, 101) + '8X~' + fake(34, 102)] },
)

const supabase = patternDetector({
  id: 'secret.supabase-key',
  category: 'cloud_credential',
  description: 'Supabase access token or secret API key',
  examples: {
    positive: ['SUPABASE_TOKEN=sb' + 'p_' + fake(40, 103, HEX), 'sb_' + 'secret_' + fake(30, 104, B64URL)],
    negative: ['sbp_short', 'xsbp_' + fake(40, 105, HEX), 'sb_secret_short'],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9_])sbp_[a-f0-9]{40}(?![A-Za-z0-9])/g,
      label: 'Supabase access token', placeholder: 'SUPABASE_KEY',
      explanation: 'Matches the format of a Supabase personal access token (sbp_ prefix).',
      confidence: 0.95, severity: 'critical',
    },
    {
      re: /(?<![A-Za-z0-9_])sb_secret_[A-Za-z0-9_-]{20,100}(?![A-Za-z0-9_-])/g,
      label: 'Supabase secret key', placeholder: 'SUPABASE_KEY',
      explanation: 'Matches the format of a Supabase secret API key (sb_secret_ prefix).',
      confidence: 0.95, severity: 'critical',
    },
  ],
})

const vercel = provider(
  'secret.vercel-token', 'Vercel token', 'VERCEL_TOKEN',
  /(?<![A-Za-z0-9_])vercel_[A-Za-z0-9]{24}(?![A-Za-z0-9])/g, 0.9,
  { positive: ['VERCEL_TOKEN=vercel_' + fake(24, 106), 'vercel' + '_' + fake(24, 107)], negative: ['vercel_short', 'xvercel_' + fake(24, 108), 'vercel_' + fake(30, 109)] },
  { accept: hasMinEntropy(3) },
)

const fly = provider(
  'secret.flyio-token', 'Fly.io access token', 'FLY_TOKEN',
  /(?<![A-Za-z0-9_])fo1_[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g, 0.95,
  { positive: ['FLY_API_TOKEN=fo' + '1_' + fake(43, 110, B64URL)], negative: ['fo1_short', 'xfo1_' + fake(43, 111, B64URL)] },
)

const fcm = provider(
  'secret.fcm-server-key', 'Firebase Cloud Messaging server key', 'FCM_KEY',
  /(?<![A-Za-z0-9_-])AAAA[A-Za-z0-9_-]{7}:APA91b[A-Za-z0-9_-]{120,180}/g, 0.95,
  { positive: ['key=AA' + 'AA' + fake(7, 112, B64URL) + ':APA' + '91b' + fake(140, 113, B64URL)], negative: ['AAAAshort:APA91bshort', 'AAAA' + fake(7, 114) + ':APA91b' + fake(20, 115)] },
)

const ageKey = patternDetector({
  id: 'secret.age-secret-key',
  category: 'private_key',
  description: 'age encryption secret key',
  examples: {
    positive: ['AGE-SECRET' + '-KEY-1' + fake(58, 116, AGE_SET)],
    negative: ['AGE-SECRET-KEY-1SHORT', 'AGE-SECRET-KEY-1' + fake(58, 117, AGE_SET).toLowerCase(), 'age-public-key'],
  },
  patterns: [
    {
      re: /(?<![A-Za-z0-9-])AGE-SECRET-KEY-1[0-9A-Z]{58}(?![A-Za-z0-9])/g,
      label: 'age secret key', placeholder: 'AGE_KEY',
      explanation: 'Matches the format of an age secret key (AGE-SECRET-KEY-1 prefix, bech32 body).',
      confidence: 0.97, severity: 'critical',
    },
  ],
})

/** Prefix-based providers: safe to run on joined lines (used by the split-token detector). */
export const PREFIX_PROVIDER_DETECTORS: Detector[] = [
  shopify, digitalocean, doppler, linear, postman, pypi, databricks, notion, grafana, atlassian,
  vault, terraform, mapbox, square, azureAd, supabase, vercel, fly, fcm, ageKey,
]

export const PROVIDER_DETECTORS: Detector[] = [...PREFIX_PROVIDER_DETECTORS, cloudflare]

