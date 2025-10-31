/**
 * API Client for Secure Server-Side Operations
 * 
 * This client replaces direct Supabase calls with authenticated API requests.
 * All requests include JWT authentication tokens from Supabase Auth.
 * 
 * @module services/apiClient
 * 
 * @example
 * ```typescript
 * import { apiGetProjects, apiCreateProject } from './services/apiClient';
 * 
 * // Fetch all user's projects
 * const projects = await apiGetProjects();
 * 
 * // Create a new project
 * const { projectId } = await apiCreateProject(property);
 * ```
 */

import { supabase } from './supabaseClient';
import { Project, Task, Room, Property } from '../types';

/** Base URL for all API requests */
const API_BASE_URL = '/api';

/**
 * Retrieves the current user's JWT access token for API authentication.
 * 
 * @returns {Promise<string | null>} The access token, or null if not authenticated
 * @throws {Error} If there's an error retrieving the session
 * 
 * @private
 * @internal
 */
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

/**
 * Makes an authenticated API request to the backend server.
 * 
 * This function handles:
 * - JWT token retrieval and attachment
 * - Error handling and response parsing
 * - Type-safe response typing
 * 
 * @template T - The expected response type
 * @param {string} endpoint - The API endpoint (e.g., '/projects', '/tasks/123')
 * @param {RequestInit} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<T>} The parsed JSON response
 * @throws {Error} If authentication fails or the request fails
 * 
 * @example
 * ```typescript
 * const projects = await apiRequest<Project[]>('/projects', { method: 'GET' });
 * ```
 * 
 * @private
 * @internal
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAuthToken();
    
    if (!token) {
        throw new Error('Not authenticated - please sign in');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });
    
    if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
            const error = await response.json();
            errorMessage = error.error || error.message || `API request failed: ${response.status}`;
            // Include validation details if present
            if (error.details && Array.isArray(error.details)) {
                errorMessage += '\nValidation errors: ' + error.details.map((d: any) => d.message || d.path?.join('.')).join(', ');
            }
        } catch {
            errorMessage = `API request failed with status ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }
    
    return response.json();
}

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

/**
 * Fetches all projects for the currently authenticated user.
 * 
 * @returns {Promise<Project[]>} Array of user's projects
 * @throws {Error} If authentication fails or API request fails
 * 
 * @example
 * ```typescript
 * const projects = await apiGetProjects();
 * console.log(`Found ${projects.length} projects`);
 * ```
 */
export const apiGetProjects = async (): Promise<Project[]> => {
    return apiRequest<Project[]>('/projects', {
        method: 'GET',
    });
};

/**
 * Fetches a single project by its ID.
 * 
 * @param {string} projectId - The UUID of the project to fetch
 * @returns {Promise<Project>} The project object
 * @throws {Error} If project not found or user doesn't have access
 * 
 * @example
 * ```typescript
 * const project = await apiGetProject('project-uuid');
 * console.log(project.property.name);
 * ```
 */
export const apiGetProject = async (projectId: string): Promise<Project> => {
    return apiRequest<Project>(`/projects/${projectId}`, {
        method: 'GET',
    });
};

/**
 * Creates a new project for the authenticated user.
 * 
 * @param {Property} property - The property/project data to create
 * @returns {Promise<{ projectId: string }>} The ID of the newly created project
 * @throws {Error} If validation fails or creation fails
 * 
 * @example
 * ```typescript
 * const property = {
 *   name: 'My Home Renovation',
 *   rooms: [{ id: '1', name: 'Living Room', photos: [] }],
 *   projectChatHistory: [],
 * };
 * const { projectId } = await apiCreateProject(property);
 * ```
 */
export const apiCreateProject = async (property: Property): Promise<{ projectId: string }> => {
    return apiRequest<{ projectId: string }>('/projects', {
        method: 'POST',
        body: JSON.stringify({ property }),
    });
};

/**
 * Updates an existing project.
 * 
 * @param {string} projectId - The UUID of the project to update
 * @param {Property} property - The updated property data
 * @returns {Promise<{ success: boolean }>} Success indicator
 * @throws {Error} If project not found, access denied, or update fails
 * 
 * @example
 * ```typescript
 * const updated = await apiUpdateProject(projectId, {
 *   ...property,
 *   visionStatement: 'Modern minimalist design',
 * });
 * ```
 */
export const apiUpdateProject = async (projectId: string, property: Property): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ property }),
    });
};

/**
 * Deletes a project permanently.
 * 
 * ⚠️ **Warning:** This action cannot be undone. All tasks, rooms, and associated data will be deleted.
 * 
 * @param {string} projectId - The UUID of the project to delete
 * @returns {Promise<{ success: boolean }>} Success indicator
 * @throws {Error} If project not found or access denied
 * 
 * @example
 * ```typescript
 * await apiDeleteProject(projectId);
 * console.log('Project deleted successfully');
 * ```
 */
export const apiDeleteProject = async (projectId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/projects/${projectId}`, {
        method: 'DELETE',
    });
};

// ============================================================================
// TASK OPERATIONS
// ============================================================================

export const apiCreateTask = async (projectId: string, task: Omit<Task, 'id'>): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ task }),
    });
};

export const apiUpdateTask = async (taskId: string, task: Task): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ task }),
    });
};

export const apiDeleteTask = async (taskId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/tasks/${taskId}`, {
        method: 'DELETE',
    });
};

// ============================================================================
// ROOM OPERATIONS
// ============================================================================

export const apiCreateRoom = async (projectId: string, roomName: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/projects/${projectId}/rooms`, {
        method: 'POST',
        body: JSON.stringify({ roomName }),
    });
};

export const apiDeleteRoom = async (roomId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/rooms/${roomId}`, {
        method: 'DELETE',
    });
};

export const apiAddPhotoToRoom = async (roomId: string, photoUrl: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/rooms/${roomId}/photos`, {
        method: 'POST',
        body: JSON.stringify({ photoUrl }),
    });
};

// ============================================================================
// IMAGE UPLOAD
// ============================================================================

export const apiUploadImage = async (dataUrl: string, fileNamePrefix: string): Promise<string> => {
    const result = await apiRequest<{ publicUrl: string }>('/upload', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, fileNamePrefix }),
    });
    return result.publicUrl;
};
