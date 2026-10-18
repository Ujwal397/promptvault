/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cspPlugin } from './build/csp.ts'

export default defineConfig({
  plugins: [react(), cspPlugin()],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/adapters/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/core/eval/corpus/**', 'src/core/eval/blind/**', '**/testing.ts', 'src/adapters/web/scan.worker.ts'],
      reporter: ['text-summary', 'html'],
      // Release gate (user rule: 80%+). Security core is held to a higher bar than the default.
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 80 },
    },
  },
})
