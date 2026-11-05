import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      // Cobreix la capa de lògica (prioritats 1-3 de docs/agents/AGENT_QA.md §2). Els
      // components i els route handlers encara no hi són: quan es provin, cal ampliar-ho
      // a `src/**` per complir el 80% global que demana l'especificació.
      include: ['src/lib/**/*.ts', 'src/features/auth/safe-redirect.ts'],
      exclude: ['src/lib/validations/index.ts', 'src/lib/db/index.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
