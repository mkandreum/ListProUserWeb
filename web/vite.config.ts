import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: '../server/public', emptyOutDir: true },
  server: { proxy: { '/api': process.env.LISTPRO_PANEL_API ?? 'http://localhost:3000' } },
});
