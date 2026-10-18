import type { EngineError, Finding, PlaceholderMode, Replacement, Span } from '../types'
import { createPlaceholderFactory } from './placeholders'

export type RedactResult =
  | { ok: true; text: string; replacements: Replacement[]; mapping: Record<string, string> }
  | { ok: false; error: EngineError }

interface Target {
  findingId: string
  start: number
  end: number
  type: string
}

function invalid(message: string): RedactResult {
  return { ok: false, error: { code: 'INVALID_FINDING_RANGE', message } }
}

function validSpan(s: Span, length: number): boolean {
  return Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end <= length && s.start < s.end
}

function targetsFor(f: Finding, structured: boolean): Target[] {
  const subs = f.sensitiveSubspans
  if (structured && subs && subs.length > 0) {
    return subs.map((s) => ({
      findingId: f.findingId,
      start: s.start,
      end: s.end,
      type: `${f.placeholderType}_SECRET`,
    }))
  }
  return [{ findingId: f.findingId, start: f.startOffset, end: f.endOffset, type: f.placeholderType }]
}

function collectTargets(
  text: string,
  findings: Finding[],
  findingIds: string[],
  structured: boolean,
): Target[] | string {
  const byId = new Map(findings.map((f) => [f.findingId, f] as const))
  const targets: Target[] = []
  for (const id of new Set(findingIds)) {
    const f = byId.get(id)
    if (!f) return 'Unknown finding id'
    if (!validSpan({ start: f.startOffset, end: f.endOffset }, text.length)) {
      return 'Finding span is out of range or inverted'
    }
    for (const t of targetsFor(f, structured)) {
      if (!validSpan(t, text.length)) return 'Finding span is out of range or inverted'
      targets.push(t)
    }
  }
  targets.sort((a, b) => a.start - b.start || a.end - b.end)
  for (let i = 1; i < targets.length; i++) {
    const prev = targets[i - 1] as Target
    if ((targets[i] as Target).start < prev.end) return 'Selected spans overlap'
  }
  return targets
}

/** Replaces the selected findings with placeholders. Never mutates its inputs. */
export function applyRedactions(
  text: string,
  findings: Finding[],
  findingIds: string[],
  mode: PlaceholderMode,
  opts: { structured: boolean },
): RedactResult {
  const targets = collectTargets(text, findings, findingIds, opts.structured)
  if (typeof targets === 'string') return invalid(targets)

  // Number in ascending document order.
  const factory = createPlaceholderFactory(mode, text)
  const mapping: Record<string, string> = {}
  const replacements: Replacement[] = targets.map((t) => {
    const value = text.slice(t.start, t.end)
    const placeholder = factory.get(t.type, value)
    if (mode === 'typed') mapping[placeholder] = value
    return { findingId: t.findingId, placeholder, start: t.start, end: t.end }
  })

  // Apply in descending offset order so earlier offsets stay valid.
  let out = text
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i] as Replacement
    out = out.slice(0, r.start) + r.placeholder + out.slice(r.end)
  }
  return { ok: true, text: out, replacements, mapping }
}
