/**
 * Activity state outside React, so every write reads the current value at call time. A scan that finishes after
 * the user cleared history or turned recording off can't write back a stale snapshot (or record after opt-out).
 */
import {
  createEventRecorder,
  type EventKind,
  type EventRecord,
  type EventRecorder,
  type EventStore,
  type SanitizeResult,
  type ScanResult,
} from '../../core'
import { readJson, STORAGE_KEYS, writeJson } from './storage'

export interface ActivitySnapshot {
  enabled: boolean
  retentionDays: number
  /** Untrusted: the recorder re-validates every record on read. */
  records: unknown[]
}

const DEFAULT: ActivitySnapshot = { enabled: false, retentionDays: 30, records: [] }

function loadSnapshot(): ActivitySnapshot {
  const raw = readJson(STORAGE_KEYS.activity)
  if (typeof raw !== 'object' || raw === null) return DEFAULT
  const r = raw as Record<string, unknown>
  return {
    enabled: r.enabled === true,
    retentionDays: typeof r.retentionDays === 'number' ? r.retentionDays : DEFAULT.retentionDays,
    records: Array.isArray(r.records) ? r.records : [],
  }
}

export interface ActivityStore {
  get: () => ActivitySnapshot
  subscribe: (listener: () => void) => () => void
  update: (patch: (prev: ActivitySnapshot) => ActivitySnapshot) => void
  /** A recorder over the current snapshot. Never cache it: build one per use. */
  recorder: () => EventRecorder
  record: (scan: ScanResult, kind: EventKind, sanitize?: SanitizeResult) => void
}

export function createActivityStore(initial: ActivitySnapshot = loadSnapshot()): ActivityStore {
  let snapshot = initial
  const listeners = new Set<() => void>()

  const update = (patch: (prev: ActivitySnapshot) => ActivitySnapshot): void => {
    snapshot = patch(snapshot)
    writeJson(STORAGE_KEYS.activity, snapshot)
    for (const listener of listeners) listener()
  }

  const recorder = (): EventRecorder => {
    const store: EventStore = {
      load: () => snapshot.records as EventRecord[],
      save: (records) => update((prev) => ({ ...prev, records })),
    }
    return createEventRecorder({ store, enabled: snapshot.enabled, retentionDays: snapshot.retentionDays })
  }

  return {
    get: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update,
    recorder,
    record: (scan, kind, sanitize) => recorder().record(scan, kind, sanitize),
  }
}
