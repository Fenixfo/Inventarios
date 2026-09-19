import { supabase } from './supabase-client'

export async function apiFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers = {
    ...options.headers,
    ...(token && { 'Authorization': `Bearer ${token}` }),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
