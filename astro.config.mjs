// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  security: {
    checkOrigin: false
  },
  adapter: cloudflare({
    imageService: 'passthrough',
    platformProxy: {
      enabled: true
    },
    sessionKVBindingName: "ERP_MIJ_SESSION_STORE"
  }),
  vite: {
    server: {
      allowedHosts: true
    },
    preview: {
      allowedHosts: true
    },
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare', '@astrojs/cloudflare/entrypoints/server.js']
    },
    ssr: {
      target: 'webworker',
      external: ['node:async_hooks', 'node:buffer', 'node:crypto', '@astrojs/cloudflare']
    }
  }
});