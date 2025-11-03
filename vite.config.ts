// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the repo base only for production builds (GitHub Pages).
export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    base: isBuild ? '/Bulacan-Mapping-Flavors/' : '/',
    
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
        '/admin': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: { sourcemap: true },
  };
});
