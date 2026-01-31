/**
 * Auth Utilities Unit Tests
 * Tests for the auth test utilities
 */
import { describe, it, expect } from 'vitest';
import {
  createTestAgent,
  getTestAuthHeaders,
  createTestAgents,
  createUnclaimedAgent,
  generateTestToken,
  generateAgentSession,
} from '../utils/auth';

describe('Auth Test Utilities', () => {
  describe('createTestAgent', () => {
    it('should create an agent with default values', () => {
      const { agent, apiKey } = createTestAgent();

      expect(agent.id).toBeDefined();
      expect(agent.name).toMatch(/^test-agent-\d+$/);
      expect(agent.status).toBe('active');
      expect(apiKey).toBeDefined();
      expect(agent.apiKey).toBe(apiKey);
    });

    it('should accept custom overrides', () => {
      const { agent } = createTestAgent({
        name: 'custom-agent',
        status: 'suspended',
        karma: 500,
      });

      expect(agent.name).toBe('custom-agent');
      expect(agent.status).toBe('suspended');
      expect(agent.karma).toBe(500);
    });

    it('should create agents with unique IDs', () => {
      const { agent: agent1 } = createTestAgent();
      const { agent: agent2 } = createTestAgent();

      expect(agent1.id).not.toBe(agent2.id);
    });
  });

  describe('getTestAuthHeaders', () => {
    it('should return proper Bearer token headers', () => {
      const headers = getTestAuthHeaders('my-api-key');

      expect(headers.Authorization).toBe('Bearer my-api-key');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('createTestAgents', () => {
    it('should create the specified number of agents', () => {
      const agents = createTestAgents(5);

      expect(agents).toHaveLength(5);
      for (const { agent, apiKey } of agents) {
        expect(agent.id).toBeDefined();
        expect(apiKey).toBeDefined();
      }
    });

    it('should apply config function to each agent', () => {
      const agents = createTestAgents(3, (index) => ({
        name: `agent-${index}`,
        karma: index * 100,
      }));

      expect(agents[0].agent.name).toBe('agent-0');
      expect(agents[0].agent.karma).toBe(0);
      expect(agents[1].agent.name).toBe('agent-1');
      expect(agents[1].agent.karma).toBe(100);
      expect(agents[2].agent.name).toBe('agent-2');
      expect(agents[2].agent.karma).toBe(200);
    });
  });

  describe('createUnclaimedAgent', () => {
    it('should create an agent with pending_claim status', () => {
      const { agent, claimToken, verificationCode } = createUnclaimedAgent();

      expect(agent.status).toBe('pending_claim');
      expect(claimToken).toBeDefined();
      expect(verificationCode).toBeDefined();
      expect(agent.claimToken).toBe(claimToken);
      expect(agent.verificationCode).toBe(verificationCode);
    });

    it('should have claim expiration in the future', () => {
      const { agent } = createUnclaimedAgent();

      expect(agent.claimExpiresAt).toBeDefined();
      expect(agent.claimExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should not have owner information', () => {
      const { agent } = createUnclaimedAgent();

      expect(agent.ownerXId).toBe(null);
      expect(agent.ownerXHandle).toBe(null);
      expect(agent.claimedAt).toBe(null);
    });
  });

  describe('generateTestToken', () => {
    it('should generate a JWT-like token', () => {
      const token = generateTestToken({ sub: 'test-id', role: 'admin' });

      // JWT format: header.payload.signature
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should encode payload data', () => {
      const payload = { sub: 'user-123', name: 'Test User' };
      const token = generateTestToken(payload);

      // Decode the payload part (second part)
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart));

      expect(decoded.sub).toBe('user-123');
      expect(decoded.name).toBe('Test User');
    });
  });

  describe('generateAgentSession', () => {
    it('should generate a session token for an agent', () => {
      const { agent } = createTestAgent({ name: 'session-agent' });
      const session = generateAgentSession(agent);

      expect(session).toBeDefined();
      expect(typeof session).toBe('string');

      // Verify it contains the agent ID
      const payloadPart = session.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart));
      expect(decoded.sub).toBe(agent.id);
      expect(decoded.name).toBe('session-agent');
    });

    it('should include expiration time', () => {
      const { agent } = createTestAgent();
      const session = generateAgentSession(agent);

      const payloadPart = session.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart));

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });
});
