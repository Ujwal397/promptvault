import type { Detector } from '../../types'
import { emailDetector } from './email'
import { FINANCIAL_DETECTORS } from './financial'
import { GOV_DETECTORS } from './govIds'
import { INTL_GOV_DETECTORS } from './govIdsIntl'
import { mrnDetector } from './health'
import { healthConditionDetector } from './healthCondition'
import { ipv4Detector } from './ipv4'
import { ipv6Detector } from './ipv6'
import { labeledNameDetector } from './labeledName'
import { phoneDetector } from './phone'

export const PII_DETECTORS: Detector[] = [
  emailDetector,
  phoneDetector,
  ipv4Detector,
  ipv6Detector,
  labeledNameDetector,
  ...GOV_DETECTORS,
  ...INTL_GOV_DETECTORS,
  ...FINANCIAL_DETECTORS,
  mrnDetector,
  healthConditionDetector,
]
