import { supabase } from './supabaseClient';
import { User } from '../types';
import { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export type { Session };

/**
 * Retrieves the currently authenticated user with their profile and friends.
 * 
 * If the user profile doesn't exist, attempts to create it from the auth user metadata.
 * This handles cases where the database trigger may have failed.
 * 
 * @returns {Promise<User | null>} User object or null if not authenticated
 */
export const getCurrentUser = async (): Promise<User | null> => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            logger.error('Failed to get user session', sessionError);
            return null;
        }

        if (!session?.user) {
            return null;
        }

        const userId = session.user.id;

        // Try to fetch existing profile
        let { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        // If profile doesn't exist, try to create it from auth metadata
        if (profileError && profileError.code === 'PGRST116') {
            logger.warn('User profile not found, attempting to create from auth metadata', { userId });
            
            const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
            const avatarUrl = session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
            
            const { data: newProfile, error: createError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    name: fullName,
                    avatar_url: avatarUrl,
                    email: session.user.email,
                    preferences: {},
                })
                .select()
                .single();
            
            if (createError) {
                logger.error('Failed to create user profile', createError, { userId });
                return null;
            }
            
            userProfile = newProfile;
            logger.info('Created user profile from auth metadata', { userId });
        } else if (profileError) {
            logger.error('Failed to fetch user profile', profileError, { userId });
            return null;
        }

        // Fetch friend IDs (non-critical, can fail gracefully)
        const { data: friends, error: friendsError } = await supabase
            .from('friends')
            .select('user_id_2')
            .eq('user_id_1', userId);

        if (friendsError) {
            logger.warn('Failed to fetch user friends (non-critical)', friendsError, { userId });
            return { 
                ...userProfile, 
                avatarUrl: userProfile.avatar_url,
                friendIds: [] 
            };
        }

        return { 
            ...userProfile, 
            avatarUrl: userProfile.avatar_url,
            friendIds: friends.map(f => f.user_id_2) 
        };
    } catch (error) {
        logger.error('Unexpected error in getCurrentUser', error);
        return null;
    }
};


/**
 * Register a new user account
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @param {string} fullName - User's full name
 * @returns {Promise} Supabase auth response
 */
export const signUp = (email: string, password: string, fullName: string) => {
    return supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                // Supabase trigger will use this to create the profile
            },
            emailRedirectTo: window.location.origin,
        },
    });
};

/**
 * Sign in an existing user
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise} Supabase auth response
 */
export const signIn = (email: string, password: string) => {
    return supabase.auth.signInWithPassword({
        email,
        password,
    });
};

/**
 * Sign out the current user
 * @returns {Promise} Supabase auth response
 */
export const signOut = () => {
    return supabase.auth.signOut();
};

/**
 * Get the current session
 * @returns {Promise} Current session data
 */
export const getSession = () => {
    return supabase.auth.getSession();
}

/**
 * Subscribe to authentication state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Object} Subscription object
 */
export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback);
}

/**
 * Update user profile information
 * @param {string} userId - User ID
 * @param {Partial<User>} updates - User profile updates
 * @returns {Promise<User | null>} Updated user object
 */
export const updateUserProfile = async (userId: string, updates: Partial<User>): Promise<User | null> => {
    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                ...(updates.name && { name: updates.name }),
                ...(updates.avatarUrl && { avatar_url: updates.avatarUrl }),
                ...(updates.email && { email: updates.email }),
                ...(updates.preferences && { preferences: updates.preferences }),
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update user profile', error, { userId });
            return null;
        }

        return {
            ...data,
            avatarUrl: data.avatar_url,
        };
    } catch (error) {
        logger.error('Unexpected error in updateUserProfile', error);
        return null;
    }
};
