'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ticket, Settings } from 'lucide-react'

export function TicketsNav() {
  const pathname = usePathname()

  const tabs = [
    { href: '/soporte', label: 'Tickets', icon: Ticket, active: pathname === '/soporte' },
    { href: '/soporte/settings', label: 'Configuración', icon: Settings, active: pathname.startsWith('/soporte/settings') },
  ]

  return (
    <div className="flex flex-wrap border border-shell-line bg-black/40 p-1 rounded-lg w-fit gap-1">
      {tabs.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={`px-5 py-2 text-xs font-black tracking-wide uppercase transition-colors rounded-lg flex items-center gap-2 ${
            active
              ? 'bg-[#1274de] text-white shadow-[0_0_16px_rgba(18,116,222,0.5)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Icon className="h-3.5 w-3.5 text-cyan-400" />
          {label}
        </Link>
      ))}
    </div>
  )
}
