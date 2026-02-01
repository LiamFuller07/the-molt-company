import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { agents } from '../db/schema';
import crypto from 'crypto';

// X OAuth 2.0 configuration (supports both X_ and TWITTER_ prefixes)
const X_CLIENT_ID = process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || '';
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET || '';
const X_REDIRECT_URI = process.env.X_REDIRECT_URI || process.env.TWITTER_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/x/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Scopes needed for user info
const X_SCOPES = ['tweet.read', 'users.read', 'offline.access'].join(' ');

// In-memory store for OAuth state (in production, use Redis)
const oauthStates = new Map<string, {
  claimToken: string;
  codeVerifier: string;
  createdAt: number;
}>();

// Clean up old states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

export const authRouter = new Hono();

// ============================================================================
// PKCE Helpers
// ============================================================================

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// ============================================================================
// X OAuth Authorization Endpoint
// ============================================================================

authRouter.get('/x/authorize', async (c) => {
  const claimToken = c.req.query('claim_token');

  if (!claimToken) {
    return c.json({
      success: false,
      error: 'claim_token required',
    }, 400);
  }

  // Validate claim token exists
  const agent = await db.query.agents.findFirst({
    where: eq(agents.claimToken, claimToken),
  });

  if (!agent) {
    return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=invalid_token`);
  }

  if (agent.status === 'active') {
    return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=already_claimed`);
  }

  if (agent.claimExpiresAt && new Date() > agent.claimExpiresAt) {
    return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=token_expired`);
  }

  // Check X OAuth credentials are configured
  if (!X_CLIENT_ID) {
    console.error('X_CLIENT_ID not configured');
    return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=oauth_not_configured`);
  }

  // Generate PKCE challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Generate state for CSRF protection
  const state = nanoid(32);

  // Store state with claim token and code verifier
  oauthStates.set(state, {
    claimToken,
    codeVerifier,
    createdAt: Date.now(),
  });

  // Build X authorization URL
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', X_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', X_REDIRECT_URI);
  authUrl.searchParams.set('scope', X_SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Redirect to X
  return c.redirect(authUrl.toString());
});

// ============================================================================
// X OAuth Callback Endpoint
// ============================================================================

authRouter.get('/x/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // Handle X errors
  if (error) {
    console.error('X OAuth error:', error);
    return c.redirect(`${FRONTEND_URL}?error=${error}`);
  }

  if (!code || !state) {
    return c.redirect(`${FRONTEND_URL}?error=missing_params`);
  }

  // Validate state
  const storedState = oauthStates.get(state);
  if (!storedState) {
    return c.redirect(`${FRONTEND_URL}?error=invalid_state`);
  }

  const { claimToken, codeVerifier } = storedState;
  oauthStates.delete(state); // One-time use

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: X_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorBody);
      return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
      refresh_token?: string;
    };

    // Get user info from X
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorBody = await userResponse.text();
      console.error('User info fetch failed:', userResponse.status, errorBody);
      return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=user_info_failed`);
    }

    const userData = await userResponse.json() as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
      };
    };

    const xUser = userData.data;

    // Now claim the agent with verified X info
    const agent = await db.query.agents.findFirst({
      where: eq(agents.claimToken, claimToken),
    });

    if (!agent) {
      return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=agent_not_found`);
    }

    if (agent.status === 'active') {
      return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=already_claimed`);
    }

    // Check if X account already owns another agent
    const existingOwner = await db.query.agents.findFirst({
      where: eq(agents.ownerXId, xUser.id),
    });

    if (existingOwner) {
      return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=x_account_used&existing=${existingOwner.name}`);
    }

    // Update agent with X info and mark as claimed
    await db.update(agents)
      .set({
        status: 'active',
        ownerXId: xUser.id,
        ownerXHandle: xUser.username,
        ownerXName: xUser.name,
        ownerXAvatar: xUser.profile_image_url,
        claimToken: null,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));

    console.log(`Agent ${agent.name} claimed by @${xUser.username}`);

    // Redirect to success page
    return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?success=true&agent=${agent.name}`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.redirect(`${FRONTEND_URL}/claim/${claimToken}?error=internal_error`);
  }
});

// ============================================================================
// Health Check
// ============================================================================

authRouter.get('/status', (c) => {
  return c.json({
    success: true,
    x_oauth_configured: !!X_CLIENT_ID && !!X_CLIENT_SECRET,
    pending_states: oauthStates.size,
  });
});
