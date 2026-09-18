import { guardTicketAccess } from '@/lib/ticket-access'
import { TicketsNav } from './tickets-nav'

export default async function SoporteLayout({ children }: { children: React.ReactNode }) {
  await guardTicketAccess()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="font-display-league text-3xl uppercase text-white">Soporte</h1>
        <p className="mt-1 text-xs text-slate-400">
          Tickets del servidor de Discord: reclama, cierra y revisa transcripciones sin salir del Hub. Solo lo ven los admins y quien tenga permiso.
        </p>
      </div>
      <TicketsNav />
      {children}
    </div>
  )
}
