import { ADVERSARIAL_CASES } from './corpus/adversarial'
import { CREDENTIAL_CASES } from './corpus/credentials'
import type { EvalCase } from './corpus/helpers'
import { MIXED_CASES } from './corpus/mixed'
import { NEGATIVE_CASES } from './corpus/negatives'
import { PII_CASES } from './corpus/pii'

export type { EvalCase, EvalExpectation, EvalTag } from './corpus/helpers'

/** Bump on any change to case text, expectations or split assignment. */
export const CORPUS_VERSION = '1.0.0'

export const EVAL_CORPUS: EvalCase[] = [
  ...CREDENTIAL_CASES,
  ...PII_CASES,
  ...NEGATIVE_CASES,
  ...ADVERSARIAL_CASES,
  ...MIXED_CASES,
]
