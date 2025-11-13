import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

type ModeConfig = {
  server: {
    host: boolean
    port: number
  }
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  const config: ModeConfig = {
    server: {
      host: true,
      port: Number(process.env.PORT || 5173),
    },
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document' || request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'html-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'style' || request.destination === 'script',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'asset-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'api-cache',
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
        manifest: {
          name: 'Kulmis Pharmacy Management',
          short_name: 'Kulmis',
          description: 'Offline-ready pharmacy & lab cashier system',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          start_url: '/',
          display: 'standalone',
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: config.server,
  }
})
