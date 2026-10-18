/** Regenerates docs/DETECTORS.md from the live detector registry and strict policy: `npm run docs:detectors`. */
import { writeFileSync } from 'node:fs'
import { BUILTIN_DETECTORS, CORE_VERSION, STRICT_POLICY, PERMISSIVE_POLICY } from '../src/core'
import type { Category } from '../src/core'

const ruleFor = (policy: typeof STRICT_POLICY, c: Category) => {
  const r = policy.rules.find((x) => x.category === c)
  return r ? `${r.action}${r.mandatory ? ' (mandatory)' : ''} ≥ ${r.minConfidence}` : policy.defaultAction
}

const byCategory = new Map<Category, typeof BUILTIN_DETECTORS>()
for (const d of BUILTIN_DETECTORS) byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d])

const lines = [
  '# Detector catalog',
  '',
  `Generated from the code (core v${CORE_VERSION}). Do not edit by hand; run \`npm run docs:detectors\`.`,
  '',
  `${BUILTIN_DETECTORS.length} built-in deterministic detectors, plus the optional local name analyzer (\`context.compromise-people\`) and user-defined custom rules.`,
  'Each detector has synthetic positive and negative examples that are asserted in unit tests.',
  '',
]
for (const [cat, ds] of byCategory) {
  lines.push(`## ${cat}`, '', `Strict policy: **${ruleFor(STRICT_POLICY, cat)}**. Permissive: **${ruleFor(PERMISSIVE_POLICY, cat)}**.`, '')
  lines.push('| Detector | Version | Description |', '|---|---|---|')
  for (const d of ds) lines.push(`| \`${d.id}\` | ${d.version} | ${d.description.replace(/\|/g, '\\|')} |`)
  lines.push('')
}
writeFileSync(new URL('../docs/DETECTORS.md', import.meta.url), lines.join('\n'))
console.log(`wrote docs/DETECTORS.md (${BUILTIN_DETECTORS.length} detectors)`)
