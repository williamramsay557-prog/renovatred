/**
 * Test Utilities and Helpers
 * 
 * Common utilities for writing tests across the application.
 * This makes tests more maintainable and reduces duplication.
 */

import { Task, Property, User, Project, TaskStatus, ChatMessage } from '../../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a mock task for testing
 */
export function createMockTask(overrides?: Partial<Task>): Task {
    return {
        id: uuidv4(),
        title: 'Test Task',
        room: 'Living Room',
        status: TaskStatus.ToDo,
        priority: 0,
        chatHistory: [],
        ...overrides,
    };
}

/**
 * Create a mock property for testing
 */
export function createMockProperty(overrides?: Partial<Property>): Property {
    return {
        id: uuidv4(),
        name: 'Test Property',
        rooms: [],
        projectChatHistory: [],
        ...overrides,
    };
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides?: Partial<User>): User {
    return {
        id: uuidv4(),
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        friendIds: [],
        ...overrides,
    };
}

/**
 * Create a mock project for testing
 */
export function createMockProject(overrides?: Partial<Project>): Project {
    return {
        id: uuidv4(),
        userId: uuidv4(),
        property: createMockProperty(),
        tasks: [],
        feedPosts: [],
        ...overrides,
    };
}

/**
 * Create a mock chat message for testing
 */
export function createMockChatMessage(
    role: 'user' | 'model' = 'user',
    text: string = 'Test message'
): ChatMessage {
    return {
        role,
        parts: [{ text }],
    };
}

/**
 * Wait for a specified number of milliseconds (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock fetch with a default successful response
 */
export function mockFetchSuccess(data: unknown) {
    return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
    } as Response);
}

/**
 * Mock fetch with an error response
 */
export function mockFetchError(status: number = 500, message: string = 'Internal Server Error') {
    return Promise.resolve({
        ok: false,
        status,
        statusText: message,
        json: async () => ({ error: message }),
    } as Response);
}

/**
 * Create a mock Supabase response
 */
export function createMockSupabaseResponse<T>(data: T, error: unknown = null) {
    return {
        data,
        error,
        count: null,
        status: error ? 400 : 200,
        statusText: error ? 'Bad Request' : 'OK',
    };
}

/**
 * Create a mock Supabase session
 */
export function createMockSession(userId: string = uuidv4()) {
    return {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        refresh_token: 'mock-refresh-token',
        user: {
            id: userId,
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        },
    };
}

/**
 * Helper to test async error handling
 */
export async function expectAsyncError<T>(
    fn: () => Promise<T>,
    errorMessage?: string
): Promise<void> {
    try {
        await fn();
        throw new Error('Expected function to throw an error');
    } catch (error) {
        if (errorMessage) {
            expect(getErrorMessage(error)).toContain(errorMessage);
        }
    }
}

/**
 * Get error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
}

