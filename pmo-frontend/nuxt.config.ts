import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

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
        target: `${process.env.NUXT_PUBLIC_API_BASE}/api`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `${process.env.NUXT_PUBLIC_API_BASE}/uploads`,
        changeOrigin: true,
      },
      // UUU-A: Serve seeded document templates from NestJS static dir (/templates).
      // Without this, template download links hit the Nuxt dev server and 404.
      '/templates': {
        target: `${process.env.NUXT_PUBLIC_API_BASE}/templates`,
        changeOrigin: true,
      },
    },
  },
})
