import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Config Vitest minimale (issue #26). Repo en layout plat (pas de src/) →
// on aligne l'alias `@` sur la racine pour résoudre les imports `@/lib/...`.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: { environment: 'node' },
})
