import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@cafe/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    // Test yang ada sekarang murni (tanpa DB). Test integrasi butuh MariaDB hidup.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
