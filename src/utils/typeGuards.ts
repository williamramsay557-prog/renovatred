/**
 * Type Guards and Type Utilities
 * 
 * Type guards help with runtime type checking and provide better TypeScript
 * type narrowing. These are especially useful when working with API responses
 * or user input.
 */

import { Task, TaskStatus, User, Project, Property, ChatMessage, Part } from '../types';

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
    return Object.values(TaskStatus).includes(value as TaskStatus);
}

/**
 * Type guard to check if an object is a valid Task
 */
export function isTask(obj: unknown): obj is Task {
    if (!obj || typeof obj !== 'object') return false;
    const task = obj as Partial<Task>;
    return (
        typeof task.id === 'string' &&
        typeof task.title === 'string' &&
        typeof task.room === 'string' &&
        isTaskStatus(task.status) &&
        typeof task.priority === 'number' &&
        Array.isArray(task.chatHistory)
    );
}

/**
 * Type guard to check if an object is a valid User
 */
export function isUser(obj: unknown): obj is User {
    if (!obj || typeof obj !== 'object') return false;
    const user = obj as Partial<User>;
    return (
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.avatarUrl === 'string' &&
        Array.isArray(user.friendIds)
    );
}

/**
 * Type guard to check if an object is a valid Project
 */
export function isProject(obj: unknown): obj is Project {
    if (!obj || typeof obj !== 'object') return false;
    const project = obj as Partial<Project>;
    return (
        typeof project.id === 'string' &&
        typeof project.userId === 'string' &&
        typeof project.property === 'object' &&
        Array.isArray(project.tasks) &&
        Array.isArray(project.feedPosts)
    );
}

/**
 * Type guard to check if an object is a valid Property
 */
export function isProperty(obj: unknown): obj is Property {
    if (!obj || typeof obj !== 'object') return false;
    const property = obj as Partial<Property>;
    return (
        typeof property.id === 'string' &&
        typeof property.name === 'string' &&
        Array.isArray(property.rooms) &&
        Array.isArray(property.projectChatHistory)
    );
}

/**
 * Type guard to check if a value is a valid ChatMessage
 */
export function isChatMessage(obj: unknown): obj is ChatMessage {
    if (!obj || typeof obj !== 'object') return false;
    const message = obj as Partial<ChatMessage>;
    return (
        (message.role === 'user' || message.role === 'model') &&
        Array.isArray(message.parts) &&
        message.parts.every(part => isPart(part))
    );
}

/**
 * Type guard to check if a value is a valid Part
 */
export function isPart(obj: unknown): obj is Part {
    if (!obj || typeof obj !== 'object') return false;
    const part = obj as Partial<Part>;
    
    // Must have either text or inlineData
    if (part.text && typeof part.text === 'string') return true;
    if (part.inlineData) {
        return (
            typeof part.inlineData.mimeType === 'string' &&
            typeof part.inlineData.data === 'string'
        );
    }
    return false;
}

/**
 * Type guard to check if a string is a valid UUID
 */
export function isUUID(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Type guard to check if a string is a valid email
 */
export function isEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

/**
 * Assert that a value is not null/undefined, throwing if it is
 * Useful for type narrowing
 */
export function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
        throw new Error(message || 'Value is null or undefined');
    }
}

