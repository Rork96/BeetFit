import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'BeetFit',
        short_name: 'BeetFit',
        description: 'Training, food and progress with an on-device camera coach.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0c0d11',
        theme_color: '#0c0d11',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell precached; the 13 MB WASM + 5.8 MB model are cached on first use instead.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['mediapipe/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/mediapipe/') || url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'bf-models', expiration: { maxEntries: 12 }, cacheableResponse: { statuses: [0, 200] } }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/food/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'bf-food', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ],
  base: '/',
  build: { target: 'es2020' },
  server: { host: true }
})
