import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['konva'],
  },
  resolve: {
    alias: {
      '@depix/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@depix/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
      '@depix/editor': fileURLToPath(new URL('../../packages/editor/src/index.ts', import.meta.url)),
      '@depix/react': fileURLToPath(new URL('../../packages/react/src/index.ts', import.meta.url)),
    },
  },
});
