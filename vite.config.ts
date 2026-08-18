import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['mascot.png'],
      manifest: {
        name: 'LunaCycle',
        short_name: 'LunaCycle',
        description: 'Empathetic menstrual cycle tracker and wellness assistant.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'mascot.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'mascot.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'mascot.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    strictPort: true,
    host: true
  }
})
