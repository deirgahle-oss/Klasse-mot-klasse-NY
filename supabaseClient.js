import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://uwsvsfepktigasnpolql.supabase.co'
const supabaseKey = 'sb_publishable_BevPqXgGFbuGtRBvz0uQNQ_yuSqxbSx'

export const supabase = createClient(supabaseUrl, supabaseKey)
