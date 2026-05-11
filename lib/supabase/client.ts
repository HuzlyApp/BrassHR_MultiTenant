import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-env';

const supabaseUrl = getSupabaseUrl()!;
const supabaseAnonKey = getSupabaseAnonKey()!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);