import { normalizeText } from '../normalize'
import type { Detector, EngineError, RawFinding, Span } from '../types'
import { buildCustomDetectors } from './customRules'
import { PII_DETECTORS } from './pii/index'
import { SECRET_DETECTORS } from './secrets/index'

export { buildCustomDetectors }

export const BUILTIN_DETECTORS: Detector[] = [...PII_DETECTORS, ...SECRET_DETECTORS]

export interface RunDetectorsOptions {
  deadline: number
  failDetectorId?: string
  now?: () => number
}

export interface RunDetectorsResult {
  raw: RawFinding[]
  errors: EngineError[]
  timedOut: boolean
  versions: Record<string, string>
}

const validSpan = (s: Span, max: number): boolean =>
  Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end <= max && s.start < s.end

/** Maps a finding from normalized to original offsets; returns null if it is invalid. */
function mapFinding(
  f: RawFinding,
  normLength: number,
  origLength: number,
  toOriginal: (i: number) => number,
): RawFinding | null {
  const span = { start: f.startOffset, end: f.endOffset }
  if (!validSpan(span, normLength)) return null
  if (typeof f.confidence !== 'number' || !Number.isFinite(f.confidence) || f.confidence < 0 || f.confidence > 1) return null
  const mapSpan = (s: Span): Span => ({ start: toOriginal(s.start), end: toOriginal(s.end - 1) + 1 })
  let subspans: Span[] | undefined
  if (f.sensitiveSubspans) {
    for (const s of f.sensitiveSubspans) {
      if (!validSpan(s, normLength) || s.start < span.start || s.end > span.end) return null
    }
    subspans = f.sensitiveSubspans.map(mapSpan)
  }
  const mapped = mapSpan(span)
  if (!validSpan(mapped, origLength)) return null
  const { sensitiveSubspans: _unused, ...rest } = f
  void _unused
  return {
    ...rest,
    startOffset: mapped.start,
    endOffset: mapped.end,
    ...(subspans ? { sensitiveSubspans: subspans } : {}),
  }
}

export function runDetectors(text: string, detectors: Detector[], opts: RunDetectorsOptions): RunDetectorsResult {
  const now = opts.now ?? Date.now
  const norm = normalizeText(text)
  const raw: RawFinding[] = [...norm.signals]
  const errors: EngineError[] = []
  const versions: Record<string, string> = {}
  let timedOut = false

  if (norm.signals.length > 0) {
    versions['normalize.invisible-chars'] = '1.0.0'
    versions['normalize.mixed-script'] = '1.0.0'
  }

  for (const det of detectors) {
    if (now() > opts.deadline) {
      timedOut = true
      break
    }
    versions[det.id] = det.version
    try {
      if (opts.failDetectorId === '*' || opts.failDetectorId === det.id) {
        throw new Error('Injected detector fault')
      }
      let invalid = 0
      for (const f of det.detect({ text: norm.normalized })) {
        const mapped = mapFinding(f, norm.normalized.length, text.length, norm.toOriginal)
        if (mapped) raw.push(mapped)
        else invalid++
      }
      if (invalid > 0) {
        errors.push({
          code: 'INVALID_FINDING_RANGE',
          message: `Detector ${det.id} produced ${invalid} invalid finding(s); they were dropped.`,
          detectorId: det.id,
        })
      }
    } catch {
      errors.push({ code: 'DETECTOR_FAILURE', message: `Detector ${det.id} failed.`, detectorId: det.id })
    }
  }

  return { raw, errors, timedOut, versions }
}
