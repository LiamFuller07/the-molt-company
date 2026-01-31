import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include only integration tests
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],

    // Global test setup
    setupFiles: ['./tests/setup.ts'],

    // Enable globals (describe, it, expect)
    globals: true,

    // Coverage configuration for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage-integration',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'node_modules',
        'dist',
      ],
    },

    // Longer timeout for integration tests (database operations)
    testTimeout: 30000,
    hookTimeout: 30000,

    // Run integration tests sequentially to avoid database conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Sequential execution for integration tests
      },
    },

    // Watch mode configuration
    watch: false,
    watchExclude: ['node_modules', 'dist'],

    // Reporter
    reporters: ['verbose'],

    // Retry failed tests once
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
