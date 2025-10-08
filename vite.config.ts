// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // MUST match your repo name exactly (case-sensitive)
  base: '/Bulacan-Mapping-Flavors/',
});
