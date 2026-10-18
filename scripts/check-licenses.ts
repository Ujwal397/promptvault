/** Fails if any production dependency (transitively) uses a license outside the allowlist: `npm run check:licenses`. */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0'])

interface NpmLsNode {
  dependencies?: Record<string, NpmLsNode & { path?: string }>
  path?: string
}

function collect(node: NpmLsNode, out: Map<string, string>): void {
  for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
    if (dep.path && !out.has(name)) out.set(name, dep.path)
    collect(dep, out)
  }
}

const tree = JSON.parse(execSync('npm ls --omit=dev --all --long --json', { encoding: 'utf8' })) as NpmLsNode
const packages = new Map<string, string>()
collect(tree, packages)

const violations: string[] = []
for (const [name, path] of [...packages].sort()) {
  const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')) as { license?: string; version: string }
  const license = pkg.license ?? 'UNKNOWN'
  // SPDX "OR" expressions pass if any branch is allowed.
  const ok = license.replace(/[()]/g, '').split(/\s+OR\s+/).some((l) => ALLOWED.has(l.trim()))
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}@${pkg.version} ${license}`)
  if (!ok) violations.push(`${name}: ${license}`)
}
if (violations.length) {
  console.error(`\nDisallowed licenses:\n  ${violations.join('\n  ')}`)
  process.exit(1)
}
console.log(`\n${packages.size} production packages, all licenses allowed.`)
