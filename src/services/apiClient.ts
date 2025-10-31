/**
 * API Client for Secure Server-Side Operations
 * 
 * This client replaces direct Supabase calls with authenticated API requests.
 * All requests include JWT authentication tokens from Supabase Auth.
 */

import { supabase } from './supabaseClient';
import { Project, Task, Room, Property } from '../types';

const API_BASE_URL = '/api';

/**
 * Get the current user's access token for API authentication
 */
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

/**
 * Make an authenticated API request
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
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `API request failed: ${response.status}`);
    }
    
    return response.json();
}

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

export const apiGetProjects = async (): Promise<Project[]> => {
    return apiRequest<Project[]>('/projects', {
        method: 'GET',
    });
};

export const apiGetProject = async (projectId: string): Promise<Project> => {
    return apiRequest<Project>(`/projects/${projectId}`, {
        method: 'GET',
    });
};

export const apiCreateProject = async (property: Property): Promise<{ projectId: string }> => {
    return apiRequest<{ projectId: string }>('/projects', {
        method: 'POST',
        body: JSON.stringify({ property }),
    });
};

export const apiUpdateProject = async (projectId: string, property: Property): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ property }),
    });
};

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
