import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Masjidul Akbar Prayer Dashboard',
          short_name: 'Masjid Dashboard',
          description: 'Prayer times for Masjidul Akbar Jummah Masjid, Matale',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'landscape',
          icons: [
            {
              src: 'https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=MasjidDashboard',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=MasjidDashboard',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
