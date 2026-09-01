import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserNotifications, markNotificationAsRead, clearAllNotifications } from '@/lib/notifications-data'

export async function GET() {
  try {
    const session = await getCurrentUser()
    if (!session?.userId) {
      return NextResponse.json({ notifications: [] })
    }

    const notifications = await getUserNotifications(session.userId)
    return NextResponse.json({ notifications })
  } catch (err) {
    console.error('Failed to get notifications:', err)
    return NextResponse.json({ notifications: [] })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentUser()
    if (!session?.userId) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { action, id } = body

    if (action === 'clearAll') {
      await clearAllNotifications(session.userId)
    } else {
      await markNotificationAsRead(session.userId, id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to update notification:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentUser()
    if (!session?.userId) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    await clearAllNotifications(session.userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to clear notifications:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
