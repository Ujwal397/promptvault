import { CATEGORIES, type Category, type EvalReport } from '../../core'
import type { EvalCorpus } from '../../adapters/web/scanClient'
import { formatMs, formatPercent } from './format'

/** What the run used. Captured when the run starts, so a later policy edit cannot relabel old numbers. */
export interface RunInfo {
  policyName: string
  /** True only for the Strict preset, the one policy expectedDecision is defined for. */
  strict: boolean
}

export const CORPUS_OPTIONS: readonly { value: EvalCorpus; label: string }[] = [
  { value: 'regression', label: 'Regression' },
  { value: 'blind', label: 'Blind' },
]

export const CORPUS_TITLES: Record<EvalCorpus, string> = {
  regression: 'Regression corpus',
  blind: 'Blind held-out corpus',
}

/** Honesty labels (docs/LIMITATIONS.md, "Measurement honesty"). Shown before and after a run, so they contain no measured numbers. */
export const CORPUS_NOTES: Record<EvalCorpus, string> = {
  regression: 'The regression corpus is synthetic and is used for tuning. It is not evidence of real-world accuracy.',
  blind:
    'The blind corpus is a frozen, held-out set. Detectors were tuned after its first run, so results from this build come from a tuned engine and are not blind.',
}

/** The only untuned blind result: run 1 in src/core/eval/blind/RESULTS.md. */
export const BLIND_RUN_ONE_NOTE =
  'The only untuned blind result is run 1: 94.2% precision and 90.7% recall (src/core/eval/blind/RESULTS.md).'

export const CATEGORY_LABELS: Record<Category, string> = {
  email: 'Email',
  phone: 'Phone',
  person_name: 'Person name',
  ip_address: 'IP address',
  gov_id: 'Government ID',
  financial: 'Financial',
  health: 'Health',
  credential: 'Credential',
  cloud_credential: 'Cloud credential',
  private_key: 'Private key',
  crypto_seed: 'Crypto seed',
  db_connection: 'Database connection',
  custom: 'Custom rule',
  obfuscation: 'Obfuscation',
}

export interface StatTile {
  label: string
  hint: string
  value: string
}

export interface CategoryRow {
  category: Category
  label: string
  expected: string
  precision: string
  recall: string
}

export interface AttackView {
  title: string
  tiles: StatTile[]
  categories: CategoryRow[]
  notes: string[]
}

function policyNote({ policyName, strict }: RunInfo): string {
  if (strict) return 'Policy accuracy compares each decision with the Strict expectations. This run used Strict.'
  return `Policy accuracy is not comparable here. Expected decisions are defined for Strict, and this run used ${policyName}.`
}

function tilesOf(report: EvalReport, run: RunInfo): StatTile[] {
  return [
    { label: 'Precision', hint: 'Reported items that were expected', value: formatPercent(report.totals.precision) },
    { label: 'Recall', hint: 'Expected items that were reported', value: formatPercent(report.totals.recall) },
    {
      label: 'False-block rate',
      hint: 'Harmless cases redacted, reviewed or blocked',
      value: formatPercent(report.falseBlockRate),
    },
    {
      label: run.strict ? 'Policy accuracy' : 'Policy accuracy vs Strict',
      hint: 'Cases whose decision matched the expectation',
      value: formatPercent(report.policyAccuracy),
    },
    { label: 'Latency p50', hint: 'Median scan time per case', value: formatMs(report.latency.p50) },
    { label: 'Latency p95', hint: '95th percentile scan time', value: formatMs(report.latency.p95) },
  ]
}

function caseCount(n: number): string {
  return `${n} ${n === 1 ? 'case' : 'cases'}`
}

function categoryRows(report: EvalReport): CategoryRow[] {
  return CATEGORIES.flatMap((category) => {
    const metrics = report.perCategory[category]
    if (!metrics) return []
    return [
      {
        category,
        label: CATEGORY_LABELS[category],
        expected: String(metrics.support),
        precision: formatPercent(metrics.precision),
        recall: formatPercent(metrics.recall),
      },
    ]
  })
}

/** Turns a measured EvalReport into display rows. Every number here comes from the report, never a constant. */
export function buildAttackView(report: EvalReport, corpus: EvalCorpus, run: RunInfo): AttackView {
  const notes = [CORPUS_NOTES[corpus]]
  if (corpus === 'blind') notes.push(BLIND_RUN_ONE_NOTE)
  notes.push(policyNote(run))
  return {
    title: `${CORPUS_TITLES[corpus]}, version ${report.corpusVersion}, ${caseCount(report.totals.cases)}`,
    tiles: tilesOf(report, run),
    categories: categoryRows(report),
    notes,
  }
}
