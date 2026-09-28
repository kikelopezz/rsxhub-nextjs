import { redirect } from 'next/navigation'
import { Gavel } from 'lucide-react'
import { getAdminAccessContext, getCurrentUser } from '@/lib/auth'

export default async function SanctionsLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser()
  if (!session) redirect('/perfil')

  const access = await getAdminAccessContext(session.userId)
  if (!access.canAccessAnyLeagueAdmin) redirect('/perfil')

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <div className="border-b border-shell-line pb-5">
        <span className="font-mono-data text-[11px] font-medium tracking-[0.35em] text-[#4ea1ff]">RACE CONTROL</span>
        <h1 className="font-display-condensed mt-1 flex items-center gap-3 text-4xl font-extrabold uppercase tracking-tight text-white md:text-5xl">
          <Gavel className="h-7 w-7 text-[#4ea1ff]" />
          Sanciones
        </h1>
        <p className="mt-2 max-w-xl text-xs text-slate-400 md:text-sm">
          Registro de sanciones de los comisarios (race directors) de tus campeonatos, exportable a Excel.
        </p>
      </div>

      {children}
    </div>
  )
}
