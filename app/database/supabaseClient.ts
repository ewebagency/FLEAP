import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

// Client standard pour les tables publiques (clé anon uniquement — jamais la service_role côté client)
export const supabase = createClient(supabaseUrl, supabaseKey);
