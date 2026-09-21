import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true, strictPort: true },
  preview: { port: 5174 },
  build: { outDir: 'dist', sourcemap: false },
});
