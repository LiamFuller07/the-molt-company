/**
 * Sentry Integration
 * Phase 22: Error monitoring and tracking for The Molt Company
 */

// Note: This is a lightweight integration that can be expanded with @sentry/node
// For now, we implement the interface without the heavy dependency

/**
 * Sentry configuration options
 */
interface SentryConfig {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  release?: string;
  serverName?: string;
  enabled?: boolean;
}

/**
 * Error context for additional metadata
 */
interface ErrorContext {
  user?: {
    id: string;
    username?: string;
    email?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

/**
 * Breadcrumb for tracking actions before an error
 */
interface Breadcrumb {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Sentry client state
 */
let isInitialized = false;
let config: SentryConfig = {};
const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 100;

/**
 * Initialize Sentry for error tracking
 * Call this at application startup
 */
export function initSentry(options?: Partial<SentryConfig>): void {
  const dsn = options?.dsn || process.env.SENTRY_DSN;

  config = {
    dsn,
    environment: options?.environment || process.env.NODE_ENV || 'development',
    tracesSampleRate: options?.tracesSampleRate ?? 0.1,
    release: options?.release || process.env.npm_package_version,
    serverName: options?.serverName || 'the-molt-company-server',
    enabled: Boolean(dsn),
  };

  isInitialized = true;

  if (config.enabled) {
    console.log('[Sentry] Initialized with DSN (first 20 chars):', dsn?.substring(0, 20) + '...');
    console.log('[Sentry] Environment:', config.environment);
    console.log('[Sentry] Traces sample rate:', config.tracesSampleRate);
  } else {
    console.log('[Sentry] Disabled - no DSN configured');
  }

  // Set up global error handlers
  setupGlobalHandlers();
}

/**
 * Set up global error handlers
 */
function setupGlobalHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    captureError(error, { level: 'fatal', tags: { type: 'uncaughtException' } });
    console.error('[Sentry] Uncaught exception:', error);
    // Allow time for error to be sent before process exits
    setTimeout(() => process.exit(1), 2000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureError(error, { level: 'error', tags: { type: 'unhandledRejection' } });
    console.error('[Sentry] Unhandled rejection:', reason);
  });
}

/**
 * Capture an error and send to Sentry
 */
export function captureError(
  error: Error,
  context?: ErrorContext | Record<string, unknown>
): string {
  const eventId = generateEventId();

  // Normalize context
  const normalizedContext: ErrorContext = {
    extra: context && !isErrorContext(context) ? context : undefined,
    ...(isErrorContext(context) ? context : {}),
  };

  // Build error report
  const errorReport = {
    eventId,
    timestamp: new Date().toISOString(),
    environment: config.environment,
    release: config.release,
    serverName: config.serverName,
    level: normalizedContext.level || 'error',
    exception: {
      type: error.name,
      value: error.message,
      stacktrace: error.stack,
    },
    user: normalizedContext.user,
    tags: normalizedContext.tags,
    extra: normalizedContext.extra,
    breadcrumbs: [...breadcrumbs],
  };

  if (config.enabled) {
    // In production, this would send to Sentry's API
    // For now, we log the error report
    console.error('[Sentry] Captured error:', {
      eventId,
      error: error.message,
      tags: normalizedContext.tags,
      extra: normalizedContext.extra,
    });

    // TODO: Implement actual Sentry API call when @sentry/node is added
    // Sentry.captureException(error, {
    //   tags: normalizedContext.tags,
    //   extra: normalizedContext.extra,
    //   user: normalizedContext.user,
    // });
  } else {
    // Log locally if Sentry is not enabled
    console.error('[Sentry-Local] Error captured:', {
      eventId,
      error: error.message,
      stack: error.stack,
      context: normalizedContext,
    });
  }

  return eventId;
}

/**
 * Capture a message (non-error) to Sentry
 */
export function captureMessage(
  message: string,
  level: ErrorContext['level'] = 'info',
  context?: Record<string, unknown>
): string {
  const eventId = generateEventId();

  if (config.enabled) {
    console.log(`[Sentry] Captured ${level} message:`, message, context);
    // TODO: Implement Sentry.captureMessage
  }

  return eventId;
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  const crumb: Breadcrumb = {
    ...breadcrumb,
    timestamp: breadcrumb.timestamp || Date.now(),
  };

  breadcrumbs.push(crumb);

  // Keep only the most recent breadcrumbs
  while (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: ErrorContext['user'] | null): void {
  if (user) {
    addBreadcrumb({
      category: 'user',
      message: `User set: ${user.id}`,
      level: 'info',
    });
  }
}

/**
 * Set a tag that will be included with all events
 */
export function setTag(key: string, value: string): void {
  // TODO: Implement global tags when @sentry/node is added
  addBreadcrumb({
    category: 'tag',
    message: `Tag set: ${key}=${value}`,
    level: 'debug',
  });
}

/**
 * Set extra context that will be included with all events
 */
export function setExtra(key: string, value: unknown): void {
  // TODO: Implement global extras when @sentry/node is added
  addBreadcrumb({
    category: 'extra',
    message: `Extra set: ${key}`,
    level: 'debug',
    data: { [key]: value },
  });
}

/**
 * Start a new span for performance monitoring
 */
export function startSpan(
  name: string,
  callback: () => Promise<unknown> | unknown
): Promise<unknown> {
  const startTime = Date.now();

  addBreadcrumb({
    category: 'span',
    message: `Started: ${name}`,
    level: 'debug',
  });

  try {
    const result = callback();

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = Date.now() - startTime;
        addBreadcrumb({
          category: 'span',
          message: `Finished: ${name} (${duration}ms)`,
          level: 'debug',
          data: { duration },
        });
      });
    }

    const duration = Date.now() - startTime;
    addBreadcrumb({
      category: 'span',
      message: `Finished: ${name} (${duration}ms)`,
      level: 'debug',
      data: { duration },
    });

    return Promise.resolve(result);
  } catch (error) {
    captureError(error as Error, { tags: { span: name } });
    throw error;
  }
}

/**
 * Wrap a function to capture any errors it throws
 */
export function wrapFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result.catch((error) => {
          captureError(error, context);
          throw error;
        });
      }

      return result;
    } catch (error) {
      captureError(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * Flush pending events (useful before shutdown)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  // TODO: Implement Sentry.flush when @sentry/node is added
  console.log('[Sentry] Flushing events...');
  await new Promise((resolve) => setTimeout(resolve, Math.min(timeout, 100)));
  return true;
}

/**
 * Close the Sentry client
 */
export async function close(timeout = 2000): Promise<boolean> {
  await flush(timeout);
  isInitialized = false;
  console.log('[Sentry] Closed');
  return true;
}

/**
 * Check if Sentry is initialized and enabled
 */
export function isEnabled(): boolean {
  return isInitialized && config.enabled === true;
}

// Helper functions

function generateEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

function isErrorContext(obj: unknown): obj is ErrorContext {
  if (typeof obj !== 'object' || obj === null) return false;
  const keys = Object.keys(obj);
  return keys.some((key) => ['user', 'tags', 'extra', 'level'].includes(key));
}

export default {
  initSentry,
  captureError,
  captureMessage,
  addBreadcrumb,
  setUser,
  setTag,
  setExtra,
  startSpan,
  wrapFunction,
  flush,
  close,
  isEnabled,
};
