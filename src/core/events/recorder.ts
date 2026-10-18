import { type Category, type SanitizeResult, type ScanResult } from '../types'
import { EventRecordSchema, toEventRecord, type EventKind, type EventRecord } from './record'

export interface EventStore {
  load(): EventRecord[]
  save(records: EventRecord[]): void
}

export function createMemoryStore(initial: unknown[] = []): EventStore {
  let data: unknown[] = [...initial]
  return {
    load: () => [...data] as EventRecord[], // untrusted by design: the recorder re-validates
    save: (records) => {
      data = [...records]
    },
  }
}

export interface RecorderOptions {
  store: EventStore
  /** Recording is opt-in. Default false. */
  enabled?: boolean
  /** Default 30, max 365. */
  retentionDays?: number
  /** Default 5000. */
  maxRecords?: number
  now?: () => Date
}

export interface EventSummary {
  total: number
  byKind: Record<EventKind, number>
  byDecision: Record<EventKind, Record<string, number>>
  byCategory: Record<EventKind, Partial<Record<Category, number>>>
  /** Of sanitize-validated records only; null when there are none. */
  validationPassRate: number | null
}

export interface EventRecorder {
  record(scan: ScanResult, kind: EventKind, sanitize?: SanitizeResult): void
  summary(): EventSummary
  export(): string
  clear(): void
  purgeExpired(): void
}

const DAY_MS = 86_400_000

export function createEventRecorder(options: RecorderOptions): EventRecorder {
  const { store } = options
  const enabled = options.enabled ?? false
  const retentionDays = Math.min(365, Math.max(1, Math.floor(options.retentionDays ?? 30)))
  const maxRecords = Math.max(1, Math.floor(options.maxRecords ?? 5000))
  const now = options.now ?? (() => new Date())

  const isFresh = (r: EventRecord): boolean => {
    const t = Date.parse(`${r.day}T00:00:00Z`)
    const age = now().getTime() - t
    // Future-dated records are invalid (they would never expire).
    return Number.isFinite(t) && age > -DAY_MS && age < (retentionDays + 1) * DAY_MS
  }

  /** Validates every record from the store; invalid or expired ones are dropped. */
  const load = (): EventRecord[] => {
    let raw: unknown[]
    try {
      const loaded: unknown = store.load()
      raw = Array.isArray(loaded) ? loaded : []
    } catch {
      return []
    }
    const out: EventRecord[] = []
    for (const item of raw) {
      const p = EventRecordSchema.safeParse(item)
      if (p.success && isFresh(p.data)) out.push(p.data)
    }
    return out
  }

  return {
    record(scan, kind, sanitize) {
      if (!enabled) return
      const rec = toEventRecord(scan, kind, { sanitize, now })
      const all = [...load(), rec]
      store.save(all.length > maxRecords ? all.slice(all.length - maxRecords) : all)
    },
    summary() {
      const records = load()
      const byKind: Record<EventKind, number> = { simulation: 0, submission: 0 }
      const byDecision: EventSummary['byDecision'] = { simulation: {}, submission: {} }
      const byCategory: EventSummary['byCategory'] = { simulation: {}, submission: {} }
      let validated = 0
      let passed = 0
      for (const r of records) {
        byKind[r.kind]++
        byDecision[r.kind][r.decision] = (byDecision[r.kind][r.decision] ?? 0) + 1
        for (const [c, n] of Object.entries(r.categoryCounts) as [Category, number][]) {
          byCategory[r.kind][c] = (byCategory[r.kind][c] ?? 0) + n
        }
        if (r.validationPassed !== null) {
          validated++
          if (r.validationPassed) passed++
        }
      }
      return { total: records.length, byKind, byDecision, byCategory, validationPassRate: validated ? passed / validated : null }
    },
    export: () => JSON.stringify(load(), null, 2),
    clear: () => store.save([]),
    purgeExpired: () => store.save(load()),
  }
}
