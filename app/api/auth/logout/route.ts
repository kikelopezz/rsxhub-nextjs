import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/session'

// POST only: a GET logout can be triggered by any page (an <img src="/api/auth/logout"> is enough).
export async function POST(request: Request) {
  await clearSession()
  // 303 so the browser follows the redirect with a GET.
  return NextResponse.redirect(new URL('/', request.url), 303)
}
