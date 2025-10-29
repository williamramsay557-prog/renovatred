// FIX: Add a triple-slash directive to make TypeScript aware of Vite's `import.meta.env`.
/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

// Use environment variables for security and flexibility
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or Anon Key is missing. Make sure to set them in your .env file or hosting provider.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
