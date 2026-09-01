import { NextRequest, NextResponse } from 'next/server'
import { buildSteamAuthUrl } from '@/lib/steam'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.searchParams.get('origin')
  const url = buildSteamAuthUrl(request, origin)
  return NextResponse.redirect(url)
}
