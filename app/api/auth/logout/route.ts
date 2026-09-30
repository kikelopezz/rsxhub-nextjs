import { clearSession } from '@/lib/session'
import { redirectTo } from '@/lib/redirect'
import { isTrustedRequestOrigin } from '@/lib/csrf'

// POST only: a GET logout can be triggered by any page (an <img src="/api/auth/logout"> is enough).
export async function POST(req: Request) {
  if (!isTrustedRequestOrigin(req)) return redirectTo('/', 303)

  await clearSession()
  // 303 so the browser follows the redirect with a GET.
  return redirectTo('/', 303)
}
