import { defineConfig } from 'vite'
import { cspPlugin } from './build/csp.ts'

// Test-only build of the privacy harness page. Same CSP as the product build.
export default defineConfig({
  root: 'e2e/harness',
  base: './',
  plugins: [cspPlugin()],
  worker: { format: 'es' },
  build: { outDir: '../../dist-harness', emptyOutDir: true, target: 'es2023' },
  preview: { port: 4175, strictPort: true, host: '127.0.0.1' },
})
