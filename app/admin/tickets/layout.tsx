import Link from 'next/link'
import { guardTicketAccess } from '@/lib/ticket-access'
import { TicketsNav } from './tickets-nav'

export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = await guardTicketAccess()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display-league text-3xl uppercase text-white">Tickets de Discord</h1>
          <p className="mt-1 text-xs text-slate-400">
            Gestiona los tickets del servidor de Discord sin salir del Hub. Solo lo ven quienes tienen acceso concedido.
          </p>
        </div>
        {isSuperAdmin && (
          <Link href="/admin" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-[#4ea1ff]">
            ← Volver al admin
          </Link>
        )}
      </div>
      <TicketsNav isSuperAdmin={isSuperAdmin} />
      {children}
    </div>
  )
}
