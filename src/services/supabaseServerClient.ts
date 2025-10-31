/**
 * Server-Side Supabase Client
 * 
 * This client uses the service_role key and should ONLY be used server-side.
 * It bypasses Row Level Security (RLS) policies, so it must be used carefully
 * with proper authentication and authorization checks.
 * 
 * DO NOT import this file in any client-side code.
 */

import { createClient } from '@supabase/supabase-js';

if (!process.env.VITE_SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL is required for server-side Supabase client');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase client');
}

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS - use with caution and proper auth checks.
 */
export const supabaseServer = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

/**
 * Create a Supabase client for a specific user (using their JWT).
 * This client respects RLS policies based on the user's permissions.
 * 
 * @param accessToken - User's JWT access token from Supabase Auth
 */
export const createUserSupabaseClient = (accessToken: string) => {
    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};
