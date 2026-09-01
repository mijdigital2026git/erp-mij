// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    },
    sessionKVBindingName: "ERP_MIJ_SESSION_STORE"
  }),
  vite: {
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare', '@astrojs/cloudflare/entrypoints/server.js']
    },
    ssr: {
      target: 'webworker',
      external: ['node:async_hooks', 'node:buffer', 'node:crypto', '@astrojs/cloudflare']
    }
  }
});