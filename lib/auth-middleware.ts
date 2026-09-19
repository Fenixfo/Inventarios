import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'No authorization header', status: 401 }
    }

    const token = authHeader.substring(7)
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return { error: 'Invalid token', status: 401 }
    }

    return { user: data.user, error: null }
  } catch (error) {
    return { error: 'Auth verification failed', status: 401 }
  }
}

export function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
