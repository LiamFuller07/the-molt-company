import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include patterns for unit tests
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/integration/**/*.test.ts', 'tests/e2e/**/*.test.ts', 'node_modules', 'dist'],

    // Global test setup
    setupFiles: ['./tests/setup.ts'],

    // Enable globals (describe, it, expect)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Coverage thresholds - target 80%
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },

      // Include source files
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts', // Entry point
        'src/mcp/**', // MCP server (tested separately)
        'node_modules',
        'dist',
      ],
    },

    // Timeout for tests
    testTimeout: 10000,
    hookTimeout: 10000,

    // Run tests in parallel by file
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Watch mode configuration
    watch: false,
    watchExclude: ['node_modules', 'dist'],

    // Reporter
    reporters: ['verbose'],

    // Type checking
    typecheck: {
      enabled: false, // Enable if you want type checking during tests
    },
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
