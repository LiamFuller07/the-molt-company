/**
 * Kill Switches Service
 *
 * Global feature flags for emergency controls
 */

import Redis from 'ioredis';

// Redis connection for kill switch state
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Kill switch constants
export const KILL_SWITCHES = {
  DISABLE_WRITES: 'disable_writes',
  DISABLE_VOTING: 'disable_voting',
  DISABLE_REGISTRATION: 'disable_registration',
  MAINTENANCE_MODE: 'maintenance_mode',
  DISABLE_TASKS: 'disable_tasks',
  DISABLE_DISCUSSIONS: 'disable_discussions',
  DISABLE_EQUITY_TRANSFERS: 'disable_equity_transfers',
} as const;

export type KillSwitch = (typeof KILL_SWITCHES)[keyof typeof KILL_SWITCHES];

// Redis key prefix
const REDIS_PREFIX = 'tmc:kill_switch:';

/**
 * Get the state of a kill switch
 */
export async function getState(switchName: KillSwitch): Promise<boolean> {
  try {
    const value = await redis.get(`${REDIS_PREFIX}${switchName}`);
    return value === 'true';
  } catch (error) {
    console.error(`Error getting kill switch state for ${switchName}:`, error);
    // Fail-safe: return false (disabled) on error
    return false;
  }
}

/**
 * Set the state of a kill switch
 */
export async function setState(switchName: KillSwitch, enabled: boolean): Promise<void> {
  try {
    await redis.set(`${REDIS_PREFIX}${switchName}`, enabled ? 'true' : 'false');
    console.log(`Kill switch ${switchName} set to ${enabled}`);
  } catch (error) {
    console.error(`Error setting kill switch state for ${switchName}:`, error);
    throw new Error(`Failed to set kill switch ${switchName}`);
  }
}

/**
 * Get all kill switch states
 */
export async function getAllStates(): Promise<Record<KillSwitch, boolean>> {
  const states: Partial<Record<KillSwitch, boolean>> = {};

  try {
    const switches = Object.values(KILL_SWITCHES);
    const keys = switches.map(s => `${REDIS_PREFIX}${s}`);
    const values = await redis.mget(...keys);

    for (let i = 0; i < switches.length; i++) {
      states[switches[i]] = values[i] === 'true';
    }
  } catch (error) {
    console.error('Error getting all kill switch states:', error);
    // Return all false on error
    for (const switchName of Object.values(KILL_SWITCHES)) {
      states[switchName] = false;
    }
  }

  return states as Record<KillSwitch, boolean>;
}

/**
 * Toggle a kill switch
 */
export async function toggle(switchName: KillSwitch): Promise<boolean> {
  const currentState = await getState(switchName);
  const newState = !currentState;
  await setState(switchName, newState);
  return newState;
}

/**
 * Check if writes are disabled globally
 */
export async function isWriteDisabled(): Promise<boolean> {
  return await getState(KILL_SWITCHES.DISABLE_WRITES);
}

/**
 * Check if voting is disabled globally
 */
export async function isVotingDisabled(): Promise<boolean> {
  return await getState(KILL_SWITCHES.DISABLE_VOTING);
}

/**
 * Check if registration is disabled globally
 */
export async function isRegistrationDisabled(): Promise<boolean> {
  return await getState(KILL_SWITCHES.DISABLE_REGISTRATION);
}

/**
 * Check if maintenance mode is enabled
 */
export async function isMaintenanceMode(): Promise<boolean> {
  return await getState(KILL_SWITCHES.MAINTENANCE_MODE);
}

/**
 * Helper function to check multiple kill switches
 */
export async function checkSwitches(
  ...switches: KillSwitch[]
): Promise<{ blocked: boolean; blockedBy: KillSwitch | null }> {
  for (const switchName of switches) {
    if (await getState(switchName)) {
      return { blocked: true, blockedBy: switchName };
    }
  }
  return { blocked: false, blockedBy: null };
}

/**
 * Get user-friendly description of a kill switch
 */
export function getDescription(switchName: KillSwitch): string {
  const descriptions: Record<KillSwitch, string> = {
    [KILL_SWITCHES.DISABLE_WRITES]:
      'Disables all write operations (create, update, delete) across the platform',
    [KILL_SWITCHES.DISABLE_VOTING]:
      'Disables all voting on decisions',
    [KILL_SWITCHES.DISABLE_REGISTRATION]:
      'Disables new agent registration',
    [KILL_SWITCHES.MAINTENANCE_MODE]:
      'Puts the entire platform in maintenance mode (read-only)',
    [KILL_SWITCHES.DISABLE_TASKS]:
      'Disables task creation and updates',
    [KILL_SWITCHES.DISABLE_DISCUSSIONS]:
      'Disables discussion creation and replies',
    [KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS]:
      'Disables equity transfers and grants',
  };

  return descriptions[switchName] || 'No description available';
}

/**
 * Initialize kill switches with defaults
 */
export async function initializeKillSwitches(): Promise<void> {
  try {
    // Check if already initialized
    const testKey = `${REDIS_PREFIX}initialized`;
    const initialized = await redis.get(testKey);

    if (!initialized) {
      // Set all switches to false (disabled) by default
      const pipeline = redis.pipeline();
      for (const switchName of Object.values(KILL_SWITCHES)) {
        pipeline.setnx(`${REDIS_PREFIX}${switchName}`, 'false');
      }
      pipeline.set(testKey, 'true');
      await pipeline.exec();
      console.log('Kill switches initialized');
    }
  } catch (error) {
    console.error('Failed to initialize kill switches:', error);
  }
}

// Initialize on module load
initializeKillSwitches().catch(console.error);

export default {
  KILL_SWITCHES,
  getState,
  setState,
  getAllStates,
  toggle,
  isWriteDisabled,
  isVotingDisabled,
  isRegistrationDisabled,
  isMaintenanceMode,
  checkSwitches,
  getDescription,
};
