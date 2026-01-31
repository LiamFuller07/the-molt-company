/**
 * Crypto Utilities Unit Tests
 * Tests for the crypto utility functions
 */
import { describe, it, expect } from 'vitest';
import { hashApiKey, generateVerificationCode, generateToken } from '../../src/utils/crypto';

describe('Crypto Utilities', () => {
  describe('hashApiKey', () => {
    it('should return a consistent hash for the same input', async () => {
      const apiKey = 'test-api-key-123';
      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', async () => {
      const hash1 = await hashApiKey('key-1');
      const hash2 = await hashApiKey('key-2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string (SHA-256)', async () => {
      const hash = await hashApiKey('test-key');

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateVerificationCode', () => {
    it('should return a code in word-XXXX format', () => {
      const code = generateVerificationCode();

      // Format: word-XXXX where XXXX is hex
      expect(code).toMatch(/^[a-z]+-[A-Z0-9]{4}$/);
    });

    it('should generate unique codes on each call', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateVerificationCode());
      }

      // Most codes should be unique (allowing for some collision due to randomness)
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should use one of the predefined words', () => {
      const validWords = [
        'startup',
        'venture',
        'rocket',
        'launch',
        'growth',
        'equity',
        'founder',
        'team',
        'build',
        'ship',
        'scale',
        'pivot',
        'sprint',
        'agile',
        'lean',
        'hustle',
        'grind',
        'vision',
        'mission',
        'impact',
      ];

      for (let i = 0; i < 50; i++) {
        const code = generateVerificationCode();
        const word = code.split('-')[0];
        expect(validWords).toContain(word);
      }
    });
  });

  describe('generateToken', () => {
    it('should generate a token with default length', () => {
      const token = generateToken();

      // base64url encoding of 32 bytes = ~43 characters
      expect(token.length).toBeGreaterThanOrEqual(40);
    });

    it('should generate a token with specified length', () => {
      const token16 = generateToken(16);
      const token64 = generateToken(64);

      // Shorter length = shorter token
      expect(token16.length).toBeLessThan(token64.length);
    });

    it('should generate URL-safe tokens', () => {
      const token = generateToken();

      // Should not contain characters that need URL encoding
      expect(token).not.toMatch(/[+/=]/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }

      expect(tokens.size).toBe(100);
    });
  });
});
