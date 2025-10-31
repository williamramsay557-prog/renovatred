/**
 * Authentication Service Tests
 * 
 * Tests for user authentication, session management, and profile updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as authService from '../services/authService';
import { createMockUser, createMockSupabaseResponse, createMockSession } from './utils/testHelpers';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';

// Mock dependencies
vi.mock('../services/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            signUp: vi.fn(),
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
            onAuthStateChange: vi.fn(),
        },
        from: vi.fn(),
    },
}));

vi.mock('../utils/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('Auth Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getCurrentUser', () => {
        it('should return user when authenticated', async () => {
            const mockUser = createMockUser();
            const mockSession = createMockSession(mockUser.id);

            // Mock session
            vi.mocked(supabase.auth.getSession).mockResolvedValue(
                createMockSupabaseResponse({ session: mockSession })
            );

            // Mock user profile fetch
            const fromMock = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue(
                            createMockSupabaseResponse({
                                ...mockUser,
                                avatar_url: mockUser.avatarUrl,
                            })
                        ),
                    }),
                }),
            });

            // Mock friends fetch
            const fromMockWithFriends = vi.fn()
                .mockReturnValueOnce({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue(
                                createMockSupabaseResponse({
                                    ...mockUser,
                                    avatar_url: mockUser.avatarUrl,
                                })
                            ),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue(
                            createMockSupabaseResponse([])
                        ),
                    }),
                });

            vi.mocked(supabase.from).mockImplementation(fromMockWithFriends);

            const result = await authService.getCurrentUser();
            
            expect(result).not.toBeNull();
            expect(result?.id).toBe(mockUser.id);
            expect(result?.name).toBe(mockUser.name);
        });

        it('should return null when not authenticated', async () => {
            vi.mocked(supabase.auth.getSession).mockResolvedValue(
                createMockSupabaseResponse({ session: null })
            );

            const result = await authService.getCurrentUser();
            expect(result).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(supabase.auth.getSession).mockRejectedValue(
                new Error('Network error')
            );

            const result = await authService.getCurrentUser();
            expect(result).toBeNull();
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('signUp', () => {
        it('should sign up a new user', async () => {
            const mockResponse = createMockSupabaseResponse({ user: {}, session: null });
            vi.mocked(supabase.auth.signUp).mockResolvedValue(mockResponse);

            const result = await authService.signUp('test@example.com', 'password123', 'Test User');
            
            expect(supabase.auth.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
                options: {
                    data: { full_name: 'Test User' },
                    emailRedirectTo: window.location.origin,
                },
            });
            expect(result).toEqual(mockResponse);
        });
    });

    describe('signIn', () => {
        it('should sign in an existing user', async () => {
            const mockResponse = createMockSupabaseResponse({ 
                user: {}, 
                session: createMockSession() 
            });
            vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue(mockResponse);

            const result = await authService.signIn('test@example.com', 'password123');
            
            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            });
            expect(result).toEqual(mockResponse);
        });
    });

    describe('signOut', () => {
        it('should sign out the current user', async () => {
            const mockResponse = createMockSupabaseResponse({});
            vi.mocked(supabase.auth.signOut).mockResolvedValue(mockResponse);

            const result = await authService.signOut();
            
            expect(supabase.auth.signOut).toHaveBeenCalled();
            expect(result).toEqual(mockResponse);
        });
    });

    describe('updateUserProfile', () => {
        it('should update user profile successfully', async () => {
            const mockUser = createMockUser();
            const updates = { name: 'Updated Name' };

            const fromMock = vi.fn().mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue(
                                createMockSupabaseResponse({
                                    ...mockUser,
                                    name: 'Updated Name',
                                    avatar_url: mockUser.avatarUrl,
                                })
                            ),
                        }),
                    }),
                }),
            });

            vi.mocked(supabase.from).mockReturnValue(fromMock() as any);

            const result = await authService.updateUserProfile(mockUser.id, updates);
            
            expect(result).not.toBeNull();
            expect(result?.name).toBe('Updated Name');
        });

        it('should return null on update error', async () => {
            const mockUser = createMockUser();
            
            const fromMock = vi.fn().mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue(
                                createMockSupabaseResponse(null, new Error('Update failed'))
                            ),
                        }),
                    }),
                }),
            });

            vi.mocked(supabase.from).mockReturnValue(fromMock() as any);

            const result = await authService.updateUserProfile(mockUser.id, { name: 'New Name' });
            
            expect(result).toBeNull();
            expect(logger.error).toHaveBeenCalled();
        });
    });
});

