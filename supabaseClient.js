import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'DIN_SUPABASE_URL'
const supabaseKey = 'DIN_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)
