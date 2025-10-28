import { supabase } from './supabaseClient';
import { User } from '../types';
import { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js';

export type { Session };

export const getCurrentUser = async (): Promise<User | null> => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        console.error("Error getting session:", sessionError);
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
        console.error("Error fetching user profile:", profileError);
        return null;
    }

    // Fetch friend IDs
    const { data: friends, error: friendsError } = await supabase
        .from('friends')
        .select('user_id_2')
        .eq('user_id_1', session.user.id);

    if (friendsError) {
        console.error("Error fetching friends:", friendsError);
        return { ...userProfile, friendIds: [] };
    }

    return { 
        ...userProfile, 
        avatarUrl: userProfile.avatar_url,
        friendIds: friends.map(f => f.user_id_2) 
    };
};


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

export const signIn = (email: string, password: string) => {
    return supabase.auth.signInWithPassword({
        email,
        password,
    });
};

export const signOut = () => {
    return supabase.auth.signOut();
};

export const getSession = () => {
    return supabase.auth.getSession();
}

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback);
}
