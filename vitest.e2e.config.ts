import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include only E2E tests
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],

    // Global test setup
    setupFiles: ['./tests/setup.ts'],

    // Enable globals (describe, it, expect)
    globals: true,

    // Coverage configuration for E2E tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage-e2e',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'node_modules',
        'dist',
      ],
    },

    // Longer timeout for E2E tests (full flow operations)
    testTimeout: 60000,
    hookTimeout: 60000,

    // Run E2E tests sequentially to avoid database conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Sequential execution for E2E tests
      },
    },

    // Watch mode configuration
    watch: false,
    watchExclude: ['node_modules', 'dist'],

    // Reporter
    reporters: ['verbose'],

    // Retry failed tests once (E2E can be flaky)
    retry: 1,
  },

  // Resolve aliases to match tsconfig
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@db': path.resolve(__dirname, './src/db'),
      '@api': path.resolve(__dirname, './src/api'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
