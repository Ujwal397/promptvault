/** Prints the synthetic-corpus metrics report for the strict policy: `npm run eval`. */
import { EVAL_CORPUS, STRICT_POLICY, evaluateWithEngine } from '../src/core'
import { BLIND_CORPUS, BLIND_CORPUS_VERSION } from '../src/core/eval/blind/corpus'

// `npm run eval -- --blind` scores the frozen, independently written corpus instead.
const blind = process.argv.includes('--blind')

const r = evaluateWithEngine(STRICT_POLICY, blind ? BLIND_CORPUS : EVAL_CORPUS)
if (blind) console.log(`BLIND corpus v${BLIND_CORPUS_VERSION}`)
const pct = (n: number | null) => (n === null ? '  n/a' : (n * 100).toFixed(1).padStart(5) + '%')
console.log(`corpus v${r.corpusVersion}  cases ${r.totals.cases}`)
console.log(
  `precision ${pct(r.totals.precision)}  recall ${pct(r.totals.recall)}  F1 ${pct(r.totals.f1)}  span ${pct(r.spanAccuracy)}  ` +
    `policy ${pct(r.policyAccuracy)}  redaction ${pct(r.redactionSuccess)}  false-block ${pct(r.falseBlockRate)}  ` +
    `latency p50 ${r.latency.p50.toFixed(2)}ms p95 ${r.latency.p95.toFixed(2)}ms`,
)
for (const [c, m] of Object.entries(r.perCategory)) {
  console.log(`  ${c.padEnd(17)} tp ${m.tp} fp ${m.fp} fn ${m.fn}  P ${pct(m.precision)}  R ${pct(m.recall)}`)
}
for (const c of r.cases.filter((c) => !c.decisionCorrect || c.fp || c.fn || c.redactionOk === false)) {
  console.log(`  miss ${c.id}: expected ${c.expectedDecision}, got ${c.actualDecision}; fp ${c.fp} fn ${c.fn}`)
}
