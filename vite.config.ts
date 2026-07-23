import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: '今日ノート',
        short_name: '今日ノート',
        description: 'タスク・習慣・目標・振り返りを、穏やかに続けるためのノート',
        theme_color: '#66a9df',
        background_color: '#f4f9fd',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'ja',
        start_url: '/#today',
        scope: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: '今日を開く',
            short_name: '今日',
            description: '今日のタスクと習慣を開きます',
            url: '/#today',
            icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'カレンダーを開く',
            short_name: 'カレンダー',
            description: '月間カレンダーを開きます',
            url: '/#calendar',
            icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        importScripts: ['/push-handler.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: [
          'icon-192x192.png',
          'icon-512x512.png',
          'maskable-icon-192x192.png',
          'maskable-icon-512x512.png',
          'assets/firebase-*.js'
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/firebase-[^/]+\.js$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'firebase-on-demand', expiration: { maxEntries: 8 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'font-cache', expiration: { maxEntries: 10 } }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@firebase/auth')) return 'firebase-auth';
          if (id.includes('node_modules/@firebase/firestore')) return 'firebase-firestore';
          if (id.includes('node_modules/@firebase/storage')) return 'firebase-storage';
          if (id.includes('node_modules/@firebase/messaging')) return 'firebase-messaging';
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
});
