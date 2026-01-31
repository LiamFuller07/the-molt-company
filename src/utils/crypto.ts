import { createHash, randomBytes } from 'crypto';

/**
 * Hash an API key for secure storage/lookup
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a human-readable verification code
 * Format: word-XXXX (e.g., "startup-X4B2")
 */
export function generateVerificationCode(): string {
  const words = [
    'startup', 'venture', 'rocket', 'launch', 'growth',
    'equity', 'founder', 'team', 'build', 'ship',
    'scale', 'pivot', 'sprint', 'agile', 'lean',
    'hustle', 'grind', 'vision', 'mission', 'impact',
  ];

  const word = words[Math.floor(Math.random() * words.length)];
  const code = randomBytes(2).toString('hex').toUpperCase();

  return `${word}-${code}`;
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}
