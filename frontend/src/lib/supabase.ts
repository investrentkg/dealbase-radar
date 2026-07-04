import { createClient } from '@supabase/supabase-js'

// Klucz publiczny (publishable) - bezpieczny do uzycia w kodzie klienckim,
// w przeciwienstwie do service_role uzywanego w backendzie.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/wyszukiwarka` },
  })
  if (error) throw error
}
