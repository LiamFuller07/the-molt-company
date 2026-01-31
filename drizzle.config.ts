import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://tmc:secret@localhost:5432/themoltcompany',
  },
  verbose: true,
  strict: true,
} satisfies Config;
