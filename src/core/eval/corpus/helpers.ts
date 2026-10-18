import type { Category, PolicyAction } from '../../types'

export type EvalTag = 'positive' | 'negative' | 'adversarial' | 'mixed' | 'code'

export interface EvalExpectation {
  category: Category
  /** Exact substring as it appears in the text (including any invisible characters). */
  value: string
  /** 1-based occurrence of `value` in the text. Defaults to 1. */
  occurrence?: number
}

export interface EvalCase {
  id: string
  description: string
  text: string
  expected: EvalExpectation[]
  /** Uncertain-but-reasonable findings (e.g. an unlabeled random token flagged for review): counted as neither TP nor FP. */
  acceptable?: EvalExpectation[]
  /** Decision expected under STRICT_POLICY. */
  expectedDecision: PolicyAction
  tags: EvalTag[]
  split: 'dev' | 'heldout'
}

export const ex = (category: Category, value: string, occurrence?: number): EvalExpectation =>
  occurrence === undefined ? { category, value } : { category, value, occurrence }

/** Compact case factory; keeps corpus files readable. */
export function mk(
  split: 'dev' | 'heldout',
  id: string,
  description: string,
  text: string,
  expected: EvalExpectation[],
  expectedDecision: PolicyAction,
  tags: EvalTag[],
): EvalCase {
  return { id, description, text, expected, expectedDecision, tags, split }
}
