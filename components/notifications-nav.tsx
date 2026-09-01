'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, Trash2, Info, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export type NotificationItem = {
  id: string
  userId: string
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string | null
}

export function NotificationsNav({
  initialNotifications = [],
}: {
  initialNotifications?: NotificationItem[]
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(() => {
    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (data.notifications && Array.isArray(data.notifications)) {
          setNotifications(data.notifications)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open, fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markRead', id }),
    }).catch(() => {})
  }

  const clearAll = () => {
    setNotifications([])
    fetch('/api/notifications', {
      method: 'DELETE',
    }).catch(() => {})
  }

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      const diffMs = Date.now() - date.getTime()
      const diffSec = Math.floor(diffMs / 1000)
      const diffMin = Math.floor(diffSec / 60)
      const diffHours = Math.floor(diffMin / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffSec < 60) return 'Just now'
      if (diffMin < 60) return `${diffMin}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      return `${diffDays}d ago`
    } catch {
      return 'Recent'
    }
  }

  const hasUnread = unreadCount > 0

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`glass glass-pill relative flex items-center justify-center h-10 w-10 transition-all cursor-pointer ${
          hasUnread
            ? 'glass-tint animate-rsx-breath shadow-[0_0_18px_rgba(18,116,222,0.8)]'
            : 'hover:bg-white/10 text-slate-200 hover:text-white'
        }`}
        title="Notification Center"
        aria-label="Notification Center"
      >
        <Bell className={`h-4 w-4 transition-colors ${hasUnread ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.9)]' : 'text-cyan-400'}`} />
        {hasUnread && (
          <>
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1274de] text-[10px] font-black text-white leading-none shadow-[0_0_12px_#00f0ff] ring-2 ring-cyan-400/80 animate-pulse z-10">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-cyan-400 opacity-75 animate-ping" />
          </>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-[min(380px,90vw)] bg-[#0c1220] border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden space-y-0 text-left animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#0f172a]/90">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-lg">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 hover:border-rose-400 text-rose-300 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 shrink-0"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Body List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/50 p-1">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-2">
                <Info className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">No pending notifications.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={`p-3 transition-all rounded-lg flex items-start gap-3 cursor-pointer ${
                    item.read
                      ? 'bg-transparent opacity-70 hover:opacity-100'
                      : 'bg-[#141d31]/80 border-l-2 border-l-cyan-400 shadow-sm hover:bg-[#1a2640]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.title.toLowerCase().includes('removed') || item.title.toLowerCase().includes('left') || item.title.toLowerCase().includes('rejected') ? (
                      <div className="p-1.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-400">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-cyan-400">
                        <Info className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white leading-tight truncate">
                        {item.title}
                      </h4>
                      <span className="text-[9px] text-slate-500 font-mono shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    {item.link && (
                      <Link
                        href={item.link}
                        onClick={() => {
                          markAsRead(item.id)
                          setOpen(false)
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        View details <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
