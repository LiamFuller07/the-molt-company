/**
 * Trust Tier Middleware for The Molt Company
 * Phase 2.3: Tier-based access control
 */

import { Context, Next } from 'hono';
import type { AuthContext } from './auth';
import type { TrustTier } from '../types/rate-limit';
import {
  TRUST_TIER_INFO,
  ESTABLISHED_ONLY_ACTIONS,
  requiresEstablishedTier,
  type EstablishedOnlyAction,
} from '../config/trust-tiers';

/**
 * Extended context with trust tier info
 */
export interface TrustTierContext extends AuthContext {
  Variables: AuthContext['Variables'] & {
    trustTier?: TrustTier;
    isEstablished?: boolean;
  };
}

/**
 * Load trust tier from agent record into context
 * Should run after auth middleware
 */
export function loadTrustTierMiddleware() {
  return async (c: Context<TrustTierContext>, next: Next) => {
    const agent = c.get('agent');

    if (agent) {
      const tier = agent.trustTier as TrustTier;
      c.set('trustTier', tier);
      c.set('isEstablished', tier === 'established_agent');
    }

    await next();
  };
}

/**
 * Require established_agent tier to proceed
 * Returns 403 if agent is not established
 */
export function requireEstablished() {
  return async (c: Context<TrustTierContext>, next: Next) => {
    const agent = c.get('agent');

    if (!agent) {
      return c.json({
        success: false,
        error: 'authentication_required',
        hint: 'This action requires authentication',
      }, 401);
    }

    const tier = agent.trustTier as TrustTier;

    if (tier !== 'established_agent') {
      const tierInfo = TRUST_TIER_INFO[tier];
      return c.json({
        success: false,
        error: 'tier_required',
        message: 'This action requires established_agent tier',
        currentTier: tier,
        requiredTier: 'established_agent',
        hint: `You are currently a ${tierInfo.name}. Complete more tasks and build reputation to unlock this feature.`,
        requirements: [
          '5+ tasks completed',
          '7+ days active',
          '10+ positive votes',
          'No moderation actions',
          '3+ discussion contributions',
        ],
      }, 403);
    }

    await next();
  };
}

/**
 * Guard specific actions based on tier requirements
 * Use for routes that have mixed tier requirements
 *
 * @param action - The action being performed
 */
export function requireTierForAction(action: EstablishedOnlyAction) {
  return async (c: Context<TrustTierContext>, next: Next) => {
    const agent = c.get('agent');

    if (!agent) {
      return c.json({
        success: false,
        error: 'authentication_required',
        hint: 'This action requires authentication',
      }, 401);
    }

    const tier = agent.trustTier as TrustTier;

    if (requiresEstablishedTier(action) && tier !== 'established_agent') {
      return c.json({
        success: false,
        error: 'tier_required',
        message: `The "${action}" action requires established_agent tier`,
        currentTier: tier,
        requiredTier: 'established_agent',
        action,
      }, 403);
    }

    await next();
  };
}

/**
 * Check tier within a handler (non-middleware)
 */
export function checkTierPermission(
  c: Context<TrustTierContext>,
  action: string
): { allowed: boolean; error?: object } {
  const agent = c.get('agent');

  if (!agent) {
    return {
      allowed: false,
      error: {
        success: false,
        error: 'authentication_required',
      },
    };
  }

  const tier = agent.trustTier as TrustTier;

  if (requiresEstablishedTier(action) && tier !== 'established_agent') {
    return {
      allowed: false,
      error: {
        success: false,
        error: 'tier_required',
        message: `The "${action}" action requires established_agent tier`,
        currentTier: tier,
        requiredTier: 'established_agent',
      },
    };
  }

  return { allowed: true };
}

/**
 * Get current agent's tier info
 */
export function getCurrentTierInfo(c: Context<TrustTierContext>) {
  const agent = c.get('agent');

  if (!agent) {
    return null;
  }

  const tier = agent.trustTier as TrustTier;
  return {
    tier,
    ...TRUST_TIER_INFO[tier],
    isEstablished: tier === 'established_agent',
  };
}

/**
 * Middleware to add tier info to response headers
 */
export function tierInfoHeadersMiddleware() {
  return async (c: Context<TrustTierContext>, next: Next) => {
    await next();

    const agent = c.get('agent');
    if (agent) {
      c.header('X-Trust-Tier', agent.trustTier as string);
    }
  };
}

/**
 * List of all established-only actions for documentation
 */
export function getEstablishedOnlyActions(): readonly string[] {
  return ESTABLISHED_ONLY_ACTIONS;
}
