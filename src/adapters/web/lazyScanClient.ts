/**
 * A ScanClient whose worker bundle (detectors, compromise, eval corpora) is fetched on first use, so the first
 * paint doesn't wait for ~1 MB of engine code. `preload()` starts the download early, e.g. when the page is idle.
 * The chunk is same-origin (script-src 'self'), and the worker inside it is still the inline blob: worker.
 */
import { STRICT_POLICY } from '../../core'
import type { ScanClient, ScanClientOptions } from './scanClient'

export interface LazyScanClient extends ScanClient {
  /** Starts loading the engine without running anything. Safe to call repeatedly. */
  preload(): void
}

type Loader = () => Promise<{ createScanClient: (opts?: ScanClientOptions) => ScanClient }>

const defaultLoader: Loader = () => import('./scanClient')

/**
 * If the chunk fails to load, calls reject; the UI treats a rejection as "not checked", never as clean.
 * A failed load is retried on the next call.
 */
export function createLazyScanClient(opts: ScanClientOptions = {}, loader: Loader = defaultLoader): LazyScanClient {
  let loading: Promise<ScanClient> | null = null
  let disposed = false

  const load = (): Promise<ScanClient> => {
    loading ??= loader().then(
      (mod) => {
        const client = mod.createScanClient(opts)
        if (disposed) client.dispose()
        return client
      },
      (error: unknown) => {
        loading = null
        throw error
      },
    )
    return loading
  }

  // Boots the worker and its NLP with a throwaway scan, so the user's first scan doesn't pay the cold start against
  // the hard timeout. The text is a fixed harmless string; its result is discarded and never recorded.
  const warmUp = (client: ScanClient): Promise<unknown> =>
    client.scan({ requestId: 'warm-up', text: 'warm up', policy: STRICT_POLICY })

  return {
    preload: () => void load().then(warmUp).catch(() => undefined),
    scan: async (req) => (await load()).scan(req),
    sanitize: async (req) => (await load()).sanitize(req),
    evaluate: async (req) => (await load()).evaluate(req),
    dispose() {
      disposed = true
      void loading?.then((client) => client.dispose()).catch(() => undefined)
    },
  }
}
