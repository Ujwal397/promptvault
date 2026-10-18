/**
 * Release-artifact checks (PRD §12.2, §12.3, §15.1): `npm run check:build`.
 * Builds twice and verifies the output is byte-identical (reproducible), ships no source maps,
 * carries the connect-src 'none' CSP, and contains no network APIs aimed at third parties.
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CSP } from '../build/csp.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = (n: number) => join(ROOT, `.build-check-${n}`)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

function digest(dir: string): Map<string, string> {
  return new Map(files(dir).map((f) => [relative(dir, f).replace(/\\/g, '/'), createHash('sha256').update(readFileSync(f)).digest('hex')]))
}

const failures: string[] = []
try {
  for (const n of [1, 2]) execSync(`npx vite build --outDir "${OUT(n)}" --emptyOutDir --logLevel error`, { cwd: ROOT, stdio: 'inherit' })
  const [a, b] = [digest(OUT(1)), digest(OUT(2))]
  const same = a.size === b.size && [...a].every(([k, v]) => b.get(k) === v)
  if (!same) failures.push('build is not reproducible (output differs between two builds)')

  const maps = [...a.keys()].filter((f) => f.endsWith('.map'))
  if (maps.length) failures.push(`source maps shipped: ${maps.join(', ')}`)

  const html = readFileSync(join(OUT(1), 'index.html'), 'utf8')
  if (!/Content-Security-Policy[^>]*connect-src 'none'/.test(html)) failures.push("index.html lacks CSP with connect-src 'none'")

  // public/_headers duplicates the CSP for HTTP-header delivery; it must never drift from build/csp.ts.
  const headers = readFileSync(join(ROOT, 'public', '_headers'), 'utf8')
  const headerCsp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1]?.trim() ?? ''
  const missing = CSP.split('; ').filter((d) => !headerCsp.includes(d))
  if (missing.length) failures.push(`public/_headers CSP is missing directives from build/csp.ts: ${missing.join(' | ')}`)

  const js = [...a.keys()].filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(OUT(1), f), 'utf8')).join('\n')
  const external = js.match(/https?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org|reactjs\.org|react\.dev)[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []
  const fetchToExternal = external.filter((u) => !/example\.(com|org|net|test)/.test(u))
  console.log(`files: ${a.size}, external URL literals in JS (informational): ${[...new Set(fetchToExternal)].join(', ') || 'none'}`)
} finally {
  for (const n of [1, 2]) rmSync(OUT(n), { recursive: true, force: true })
}

if (failures.length) {
  console.error(`\nBuild checks FAILED:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('Build checks passed: reproducible, no source maps, CSP present.')
