import type { Detector } from '../../types'
import { ASSIGNMENT_DETECTORS } from './assignments'
import { BEARER_DETECTORS } from './bearer'
import { CLOUD_DETECTORS } from './cloud'
import { CRYPTO_DETECTORS } from './crypto'
import { DATABASE_DETECTORS } from './database'
import { createEntropyDetector } from './entropy'
import { KEY_DETECTORS } from './keys'
import { PROSE_PASSWORD_DETECTORS } from './prosePassword'
import { PROVIDER_DETECTORS } from './providers'
import { SPLIT_TOKEN_DETECTORS } from './splitTokens'
import { TOKEN_DETECTORS } from './tokens'

const SPECIFIC_DETECTORS: Detector[] = [
  ...CLOUD_DETECTORS,
  ...TOKEN_DETECTORS,
  ...PROVIDER_DETECTORS,
  ...BEARER_DETECTORS,
  ...ASSIGNMENT_DETECTORS,
  ...PROSE_PASSWORD_DETECTORS,
  ...SPLIT_TOKEN_DETECTORS,
  ...KEY_DETECTORS,
  ...CRYPTO_DETECTORS,
  ...DATABASE_DETECTORS,
]

/** All secret/credential detectors. The entropy detector goes last and defers to the others. */
export const SECRET_DETECTORS: Detector[] = [...SPECIFIC_DETECTORS, createEntropyDetector(SPECIFIC_DETECTORS)]
