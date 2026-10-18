/**
 * Zod probes `new Function` on first object parse to decide whether to JIT. The probe's error is caught, but a
 * strict CSP (no 'unsafe-eval') still reports it as a violation. `jitless` skips the probe. Import this first.
 */
import { z } from 'zod'

z.config({ jitless: true })
