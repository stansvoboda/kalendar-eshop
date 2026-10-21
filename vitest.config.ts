import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so tests don't boot the Cloudflare/Start plugins.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
