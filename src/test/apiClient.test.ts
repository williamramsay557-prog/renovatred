/**
 * API Client Tests
 * 
 * Tests for the authenticated API client that handles communication
 * with the backend server.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as apiClient from '../services/apiClient';
import { createMockProject, createMockTask, createMockProperty, createMockSupabaseResponse, createMockSession } from './utils/testHelpers';
import { supabase } from '../services/supabaseClient';

// Mock supabase client
vi.mock('../services/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
        },
    },
}));

// Mock global fetch
global.fetch = vi.fn();

describe('API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock: authenticated user
        vi.mocked(supabase.auth.getSession).mockResolvedValue(
            createMockSupabaseResponse({ session: createMockSession() })
        );
    });

    describe('Authentication', () => {
        it('should include auth token in requests', async () => {
            const mockProjects = [createMockProject()];
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockProjects,
            });

            await apiClient.apiGetProjects();
            
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/projects',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-access-token',
                    }),
                })
            );
        });

        it('should throw error when user is not authenticated', async () => {
            vi.mocked(supabase.auth.getSession).mockResolvedValue(
                createMockSupabaseResponse({ session: null })
            );

            await expect(apiClient.apiGetProjects()).rejects.toThrow('Not authenticated');
        });
    });

    describe('apiGetProjects', () => {
        it('should fetch projects successfully', async () => {
            const mockProjects = [createMockProject(), createMockProject()];
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockProjects,
            });

            const result = await apiClient.apiGetProjects();
            expect(result).toEqual(mockProjects);
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/projects',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-access-token',
                    }),
                })
            );
        });

        it('should handle API errors', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' }),
            });

            await expect(apiClient.apiGetProjects()).rejects.toThrow('Server error');
        });
    });

    describe('apiGetProject', () => {
        it('should fetch a single project by ID', async () => {
            const mockProject = createMockProject();
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockProject,
            });

            const result = await apiClient.apiGetProject(mockProject.id);
            expect(result).toEqual(mockProject);
            expect(global.fetch).toHaveBeenCalledWith(
                `/api/projects/${mockProject.id}`,
                expect.objectContaining({ method: 'GET' })
            );
        });
    });

    describe('apiCreateProject', () => {
        it('should create a new project', async () => {
            const mockProperty = createMockProperty();
            const projectId = 'new-project-id';
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ projectId }),
            });

            const result = await apiClient.apiCreateProject(mockProperty);
            expect(result.projectId).toBe(projectId);
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/projects',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ property: mockProperty }),
                })
            );
        });
    });

    describe('apiUpdateTask', () => {
        it('should update a task', async () => {
            const mockTask = createMockTask();
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ success: true }),
            });

            const result = await apiClient.apiUpdateTask(mockTask.id, mockTask);
            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                `/api/tasks/${mockTask.id}`,
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ task: mockTask }),
                })
            );
        });
    });

    describe('apiUploadImage', () => {
        it('should upload an image and return public URL', async () => {
            const publicUrl = 'https://example.com/image.jpg';
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ publicUrl }),
            });

            const result = await apiClient.apiUploadImage('data:image/png;base64,test', 'test-image');
            expect(result).toBe(publicUrl);
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/upload',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        dataUrl: 'data:image/png;base64,test',
                        fileNamePrefix: 'test-image',
                    }),
                })
            );
        });
    });
});

