import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://DIN-PROSJEKT-URL.supabase.co'
const supabaseKey = 'sb_publishable_BevPqXgGFbuGtRBvz0uQNQ_yuSqxbSx'

export const supabase = createClient(supabaseUrl, supabaseKey)
