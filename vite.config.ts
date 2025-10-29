// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use the repo base only for production builds (GitHub Pages).
export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  return {
    plugins: [react()],
    base: isBuild ? '/Bulacan-Mapping-Flavors/' : '/',
    
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: { sourcemap: true },
  };
});
