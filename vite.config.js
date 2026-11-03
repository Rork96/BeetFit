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
        // Long-press the home-screen icon (Android, desktop) to jump straight in.
        shortcuts: [
          { name: 'Log food', short_name: 'Food', url: '/?tab=meals', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Train', short_name: 'Train', url: '/?tab=workout', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Progress', short_name: 'Progress', url: '/?tab=progress', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] }
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        importScripts: ['push-sw.js'], // push + notification click handlers
        // App shell precached; the 13 MB WASM + 5.8 MB model are cached on first use instead.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['mediapipe/**', '**/Gem3D-*.js'], // 3D mark (three.js) loads on first use only
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
            urlPattern: ({ url }) => /\/assets\/Gem3D-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'bf-3d', expiration: { maxEntries: 4 } }
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
