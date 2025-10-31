import { supabase } from './supabaseClient';
import { User } from '../types';
import { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export type { Session };

/**
 * Retrieves the currently authenticated user with their profile and friends
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

        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) {
            logger.error('Failed to fetch user profile', profileError, { userId: session.user.id });
            return null;
        }

        // Fetch friend IDs
        const { data: friends, error: friendsError } = await supabase
            .from('friends')
            .select('user_id_2')
            .eq('user_id_1', session.user.id);

        if (friendsError) {
            logger.error('Failed to fetch user friends', friendsError, { userId: session.user.id });
            return { ...userProfile, avatarUrl: userProfile.avatar_url, friendIds: [] };
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
