import { fileURLToPath } from 'node:url'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

// Nuxt DevTools "open in editor" (and the Vite error overlay's file links) delegate to
// the `launch-editor` package, which has no nuxt.config option of its own — it reads
// LAUNCH_EDITOR from the environment, otherwise it guesses from running processes and
// usually lands on VS Code.
//
// On Windows we point it at a shim rather than at `webstorm` directly. launch-editor
// emits "--line N --column M <file>" for every JetBrains IDE, which WebStorm 2026.2
// rejects with "unrecognized option: --line" (exit code 1) because those options are
// only valid after a project directory. scripts/open-in-webstorm.cmd inserts that
// directory; see the comments in it for the full argument grammar.
//
// Only set when the developer has not already exported LAUNCH_EDITOR themselves, and
// never in production, where the DevTools server middleware is not registered at all.
if (process.env.NODE_ENV !== 'production' && !process.env.LAUNCH_EDITOR) {
  process.env.LAUNCH_EDITOR =
    process.platform === 'win32'
      ? fileURLToPath(new URL('./scripts/open-in-webstorm.cmd', import.meta.url))
      : 'webstorm'
}

// Where Nitro's devProxy forwards /api, /uploads and /templates. Kept SEPARATE from
// NUXT_PUBLIC_API_BASE on purpose: apiBase is what the BROWSER prepends, and it must
// stay empty in development so requests are relative and therefore same-origin, which
// is what avoids CORS entirely. The proxy target is what the NUXT SERVER dials, and it
// always needs a concrete host. Previously both read NUXT_PUBLIC_API_BASE, so leaving
// apiBase empty silently produced the target "undefined/api".
// Override with NUXT_DEV_PROXY_TARGET when the backend is not on localhost:3000.
const devProxyTarget =
  process.env.NUXT_DEV_PROXY_TARGET || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  // OB (2026-05-21): Disable Nuxt's default path-prefix for nested component dirs.
  // Without this, components/coi/CiFoo.vue auto-resolves as <CoiCiFoo> not <CiFoo>,
  // causing silent render failures for any component used as a bare tag.
  // Safe: all coi/ components already use the "Ci" prefix — no basename collisions.
  components: {
    dirs: [
      { path: '~/components', pathPrefix: false },
    ],
  },

  build: {
    transpile: ['vuetify'],
  },

  modules: [
    '@pinia/nuxt',
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        config.plugins?.push(vuetify({ autoImport: true }))
      })
    },
  ],

  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    // Fix HMR WebSocket connection - align with Nuxt dev server port
    // Without this, Vite HMR tries to connect to port 5173 while browser is on 3001
    server: {
      hmr: {
        clientPort: 3001,
      },
    },
  },

  css: ['@mdi/font/css/materialdesignicons.css'],

  runtimeConfig: {
    public: {
      // Empty string = use relative URLs, letting Nitro devProxy handle routing
      // This avoids CORS issues by keeping requests same-origin
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
    },
  },

  ssr: false, // SPA mode for admin dashboard (auth-required pages)

  // Dev proxy: /api → NestJS backend; /uploads → NestJS static file server (KY-A3)
  nitro: {
    devProxy: {
      '/api': {
        target: `${devProxyTarget}/api`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `${devProxyTarget}/uploads`,
        changeOrigin: true,
      },
      // UUU-A: Serve seeded document templates from NestJS static dir (/templates).
      // Without this, template download links hit the Nuxt dev server and 404.
      '/templates': {
        target: `${devProxyTarget}/templates`,
        changeOrigin: true,
      },
    },
  },
})
