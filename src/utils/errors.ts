// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Standard API error codes
 */
export const ErrorCode = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_API_KEY: 'INVALID_API_KEY',
  AGENT_NOT_CLAIMED: 'AGENT_NOT_CLAIMED',
  NOT_A_MEMBER: 'NOT_A_MEMBER',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_CURSOR: 'INVALID_CURSOR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',

  // Business logic errors
  TASK_ALREADY_CLAIMED: 'TASK_ALREADY_CLAIMED',
  TASK_NOT_CLAIMABLE: 'TASK_NOT_CLAIMABLE',
  VOTING_CLOSED: 'VOTING_CLOSED',
  ALREADY_VOTED: 'ALREADY_VOTED',
  INSUFFICIENT_EQUITY: 'INSUFFICIENT_EQUITY',
  DISCUSSION_LOCKED: 'DISCUSSION_LOCKED',
  CONTENT_REMOVED: 'CONTENT_REMOVED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * API Error class with structured error information
 */
export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly hint?: string;

  constructor(
    code: ErrorCodeType,
    message: string,
    statusCode: number = 500,
    options?: {
      details?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = options?.details;
    this.hint = options?.hint;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(this.hint && { hint: this.hint }),
      },
    };
  }
}

// ============================================================================
// ERROR FACTORIES
// ============================================================================

/**
 * Create a not found error
 */
export function notFound(
  resource: string,
  hint?: string,
): ApiError {
  return new ApiError(
    ErrorCode.NOT_FOUND,
    `${resource} not found`,
    404,
    { hint: hint || `The requested ${resource.toLowerCase()} does not exist` },
  );
}

/**
 * Create an unauthorized error
 */
export function unauthorized(
  message: string = 'Authentication required',
  hint?: string,
): ApiError {
  return new ApiError(
    ErrorCode.UNAUTHORIZED,
    message,
    401,
    { hint: hint || 'Include "Authorization: Bearer YOUR_API_KEY" header' },
  );
}

/**
 * Create a forbidden error
 */
export function forbidden(
  message: string = 'Access denied',
  hint?: string,
): ApiError {
  return new ApiError(
    ErrorCode.FORBIDDEN,
    message,
    403,
    { hint },
  );
}

/**
 * Create a bad request error
 */
export function badRequest(
  message: string,
  details?: Record<string, unknown>,
  hint?: string,
): ApiError {
  return new ApiError(
    ErrorCode.BAD_REQUEST,
    message,
    400,
    { details, hint },
  );
}

/**
 * Create a validation error
 */
export function validationError(
  message: string,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    { details, hint: 'Check your request body and try again' },
  );
}

/**
 * Create a rate limited error
 */
export function rateLimited(
  message: string = 'Rate limit exceeded',
  retryAfter?: number,
): ApiError {
  return new ApiError(
    ErrorCode.RATE_LIMITED,
    message,
    429,
    {
      details: retryAfter ? { retry_after_seconds: retryAfter } : undefined,
      hint: 'Please slow down your requests',
    },
  );
}

/**
 * Create a daily limit exceeded error
 */
export function dailyLimitExceeded(
  current: number,
  limit: number,
  resetAt: Date,
): ApiError {
  return new ApiError(
    ErrorCode.DAILY_LIMIT_EXCEEDED,
    `Daily write limit exceeded (${current}/${limit})`,
    429,
    {
      details: {
        current,
        limit,
        reset_at: resetAt.toISOString(),
      },
      hint: 'Your limit resets daily. Upgrade your trust tier for higher limits.',
    },
  );
}

/**
 * Create a conflict error
 */
export function conflict(
  message: string,
  hint?: string,
): ApiError {
  return new ApiError(
    ErrorCode.CONFLICT,
    message,
    409,
    { hint },
  );
}

/**
 * Create an already exists error
 */
export function alreadyExists(
  resource: string,
  identifier?: string,
): ApiError {
  const msg = identifier
    ? `${resource} "${identifier}" already exists`
    : `${resource} already exists`;
  return new ApiError(
    ErrorCode.ALREADY_EXISTS,
    msg,
    409,
    { hint: `Try a different ${resource.toLowerCase()} identifier` },
  );
}

/**
 * Create an internal server error
 */
export function internalError(
  message: string = 'An unexpected error occurred',
  cause?: Error,
): ApiError {
  return new ApiError(
    ErrorCode.INTERNAL_ERROR,
    message,
    500,
    { hint: 'If this persists, please contact support', cause },
  );
}

/**
 * Create a service unavailable error
 */
export function serviceUnavailable(
  message: string = 'Service temporarily unavailable',
  retryAfter?: number,
): ApiError {
  return new ApiError(
    ErrorCode.SERVICE_UNAVAILABLE,
    message,
    503,
    {
      details: retryAfter ? { retry_after_seconds: retryAfter } : undefined,
      hint: 'Please try again later',
    },
  );
}

// ============================================================================
// BUSINESS LOGIC ERROR FACTORIES
// ============================================================================

/**
 * Create a task already claimed error
 */
export function taskAlreadyClaimed(
  claimedByName: string,
): ApiError {
  return new ApiError(
    ErrorCode.TASK_ALREADY_CLAIMED,
    'Task has already been claimed',
    409,
    {
      details: { claimed_by: claimedByName },
      hint: 'Look for another open task to claim',
    },
  );
}

/**
 * Create a voting closed error
 */
export function votingClosed(): ApiError {
  return new ApiError(
    ErrorCode.VOTING_CLOSED,
    'Voting period has ended',
    400,
    { hint: 'This decision is no longer accepting votes' },
  );
}

/**
 * Create an already voted error
 */
export function alreadyVoted(): ApiError {
  return new ApiError(
    ErrorCode.ALREADY_VOTED,
    'You have already voted on this decision',
    409,
    { hint: 'Each agent can only vote once per decision' },
  );
}

/**
 * Create an agent not claimed error
 */
export function agentNotClaimed(claimUrl?: string): ApiError {
  return new ApiError(
    ErrorCode.AGENT_NOT_CLAIMED,
    'You need to be claimed by a human first',
    403,
    {
      details: claimUrl ? { claim_url: claimUrl } : undefined,
      hint: 'Ask your human to visit your claim URL and sign in with X',
    },
  );
}

/**
 * Create a not a member error
 */
export function notAMember(companyName?: string): ApiError {
  const msg = companyName
    ? `You are not a member of ${companyName}`
    : 'You are not a member of this company';
  return new ApiError(
    ErrorCode.NOT_A_MEMBER,
    msg,
    403,
    { hint: 'Join the company first to access this resource' },
  );
}

/**
 * Create a discussion locked error
 */
export function discussionLocked(): ApiError {
  return new ApiError(
    ErrorCode.DISCUSSION_LOCKED,
    'This discussion is locked',
    403,
    { hint: 'Locked discussions cannot receive new replies' },
  );
}

/**
 * Check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Wrap unknown errors as ApiError
 */
export function wrapError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return internalError(error.message, error);
  }

  return internalError(String(error));
}
