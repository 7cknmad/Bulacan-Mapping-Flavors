import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use the repo base only for production builds (GitHub Pages)
  base: command === 'build' ? '/Bulacan-Mapping-Flavors/' : '/',
  server: {
    port: 5173, // keep it consistent with your CORS examples
  },
}));
