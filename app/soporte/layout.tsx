import Link from 'next/link'
import { Ticket, Settings, Users } from 'lucide-react'
import { guardTicketAccess } from '@/lib/ticket-access'

const tabs = [
  { href: '/soporte', label: 'Tickets', icon: Ticket },
  { href: '/soporte/crm', label: 'CRM', icon: Users },
  { href: '/soporte/settings', label: 'Ajustes', icon: Settings },
]

export default async function SoporteLayout({ children }: { children: React.ReactNode }) {
  await guardTicketAccess()

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <div className="border-b border-shell-line pb-5">
        <span className="font-mono-data text-[11px] font-medium tracking-[0.35em] text-[#4ea1ff]">SOPORTE</span>
        <h1 className="font-display-condensed mt-1 flex items-center gap-3 text-4xl font-extrabold uppercase tracking-tight text-white md:text-5xl">
          <Ticket className="h-7 w-7 text-[#4ea1ff]" />
          Tickets de Discord
        </h1>
        <p className="mt-2 max-w-xl text-xs text-slate-400 md:text-sm">
          Panel de tickets, historial de pilotos (CRM) y configuración del bot de soporte.
        </p>
      </div>

      <nav className="flex gap-2 border-b border-shell-line">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-[#4ea1ff]/50 hover:text-white"
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}
