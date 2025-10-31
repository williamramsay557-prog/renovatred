/**
 * Custom Error Classes for Better Error Handling
 * 
 * These custom error classes allow for more specific error handling
 * and better error messages throughout the application.
 */

/**
 * Base application error class
 */
export class AppError extends Error {
    constructor(
        message: string,
        public code?: string,
        public statusCode: number = 500,
        public context?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends AppError {
    constructor(message: string = 'Authentication failed', context?: Record<string, unknown>) {
        super(message, 'AUTH_ERROR', 401, context);
    }
}

/**
 * Validation errors for user input
 */
export class ValidationError extends AppError {
    constructor(
        message: string,
        public field?: string,
        context?: Record<string, unknown>
    ) {
        super(message, 'VALIDATION_ERROR', 400, { field, ...context });
    }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        super(
            id ? `${resource} with id ${id} not found` : `${resource} not found`,
            'NOT_FOUND',
            404,
            { resource, id }
        );
    }
}

/**
 * API/service errors from external services
 */
export class ServiceError extends AppError {
    constructor(
        message: string,
        public service: string,
        statusCode: number = 502,
        context?: Record<string, unknown>
    ) {
        super(message, 'SERVICE_ERROR', statusCode, { service, ...context });
    }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests', retryAfter?: number) {
        super(message, 'RATE_LIMIT', 429, { retryAfter });
    }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Extract error message safely from any error type
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unknown error occurred';
}

/**
 * Extract error code from error if available
 */
export function getErrorCode(error: unknown): string | undefined {
    if (isAppError(error)) {
        return error.code;
    }
    return undefined;
}

