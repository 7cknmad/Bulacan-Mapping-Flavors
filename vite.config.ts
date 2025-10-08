import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 👇 must match your repo name EXACTLY (including caps)
  base: '/Bulacan-Mapping-Flavors/',
}));
