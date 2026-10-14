import { ClassBadge } from '@/components/class-badge'
import { updateCarPaymentStatus, updateRegistrationStatus } from '../actions/admin-registrations'
import type { PaymentReviewDTO } from '@/lib/data/registrations'

const STATUS_STYLES: Record<PaymentReviewDTO['status'], { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
  approved: { label: 'Aprobada', className: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' },
  waitlist: { label: 'Lista de espera', className: 'border-sky-500/40 bg-sky-950/40 text-sky-300' },
  rejected: { label: 'Rechazada', className: 'border-rose-500/40 bg-rose-950/40 text-rose-300' },
}

type Group = {
  key: string
  leagueId: string
  leagueTitle: string
  teamId: string | null
  teamName: string | null
  classTag: string | null
  assignedNumber: number | null
  status: PaymentReviewDTO['status']
  createdAt: string
  soloRegistrationId: string
}

// Una fila por COCHE (equipo + liga + clase + dorsal) — un equipo con varios coches en la
// misma liga sale en varias filas, cada una con su propio Pagado/No pagado, en vez de aprobar
// todo el equipo de golpe. Un mismo coche puede tener varias filas de inscripción (un piloto
// titular + reserva, por ejemplo) que colapsan aquí en una sola.
function groupReviews(reviews: PaymentReviewDTO[]): Group[] {
  const byKey = new Map<string, Group>()
  for (const r of reviews) {
    const key = r.teamId ? `${r.teamId}::${r.leagueId}::${r.classTag ?? ''}::${r.assignedNumber ?? ''}` : `solo-${r.id}`
    const existing = byKey.get(key)
    if (existing) {
      if (r.createdAt < existing.createdAt) existing.createdAt = r.createdAt
      // Las filas de un mismo coche se actualizan juntas, pero si llegaran a desincronizarse,
      // se prefiere enseñarlo como ya resuelto antes que como pendiente eterno.
      if (existing.status === 'pending' && r.status !== 'pending') existing.status = r.status
    } else {
      byKey.set(key, {
        key,
        leagueId: r.leagueId,
        leagueTitle: r.leagueTitle,
        teamId: r.teamId,
        teamName: r.teamName,
        classTag: r.classTag,
        assignedNumber: r.assignedNumber,
        status: r.status,
        createdAt: r.createdAt,
        soloRegistrationId: r.id,
      })
    }
  }
  return Array.from(byKey.values())
}

function GroupRow({ group }: { group: Group }) {
  const status = STATUS_STYLES[group.status]

  return (
    <tr className="hover:bg-white/[0.02] transition-colors align-top">
      <td className="p-3 font-bold text-white">
        <span className="max-w-[180px] truncate">{group.teamName || 'Sin equipo'}</span>
      </td>
      <td className="p-3 text-xs text-slate-300">{group.leagueTitle}</td>
      <td className="p-3">
        <span className="inline-flex items-center gap-1">
          {group.classTag && <ClassBadge classTag={group.classTag} className="text-[10px] font-black" />}
          {group.assignedNumber != null && (
            <span className="font-mono-data shrink-0 rounded-md border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] px-2 py-0.5 text-xs font-black text-[#4ea1ff]">
              #{group.assignedNumber}
            </span>
          )}
        </span>
      </td>
      <td className="p-3 font-mono text-xxs text-slate-400">{new Date(group.createdAt).toLocaleDateString()}</td>
      <td className="p-3">
        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
          {status.label}
        </span>
      </td>
      <td className="p-3 text-right">
        {
          <div className="flex items-center justify-end gap-1.5">
            {group.teamId ? (
              <>
                <form action={updateCarPaymentStatus}>
                  <input type="hidden" name="leagueId" value={group.leagueId} />
                  <input type="hidden" name="teamId" value={group.teamId} />
                  <input type="hidden" name="classTag" value={group.classTag ?? '__NULL__'} />
                  <input type="hidden" name="carNumber" value={group.assignedNumber ?? ''} />
                  <input type="hidden" name="status" value="approved" />
                  <input type="hidden" name="returnTo" value="/admin?tab=pagos&updated=1" />
                  <button className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold uppercase text-emerald-400 transition-colors hover:bg-emerald-500/20">
                    Pagado
                  </button>
                </form>
                <form action={updateCarPaymentStatus}>
                  <input type="hidden" name="leagueId" value={group.leagueId} />
                  <input type="hidden" name="teamId" value={group.teamId} />
                  <input type="hidden" name="classTag" value={group.classTag ?? '__NULL__'} />
                  <input type="hidden" name="carNumber" value={group.assignedNumber ?? ''} />
                  <input type="hidden" name="status" value="rejected" />
                  <input type="hidden" name="returnTo" value="/admin?tab=pagos&updated=1" />
                  <button className="rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[10px] font-bold uppercase text-rose-400 transition-colors hover:bg-rose-500/20">
                    No pagado
                  </button>
                </form>
              </>
            ) : (
              <>
                <form action={updateRegistrationStatus}>
                  <input type="hidden" name="registrationId" value={group.soloRegistrationId} />
                  <input type="hidden" name="leagueId" value={group.leagueId} />
                  <input type="hidden" name="status" value="approved" />
                  <input type="hidden" name="returnTo" value="/admin?tab=pagos&updated=1" />
                  <button className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold uppercase text-emerald-400 transition-colors hover:bg-emerald-500/20">
                    Pagado
                  </button>
                </form>
                <form action={updateRegistrationStatus}>
                  <input type="hidden" name="registrationId" value={group.soloRegistrationId} />
                  <input type="hidden" name="leagueId" value={group.leagueId} />
                  <input type="hidden" name="status" value="rejected" />
                  <input type="hidden" name="returnTo" value="/admin?tab=pagos&updated=1" />
                  <button className="rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[10px] font-bold uppercase text-rose-400 transition-colors hover:bg-rose-500/20">
                    No pagado
                  </button>
                </form>
              </>
            )}
          </div>
        }
      </td>
    </tr>
  )
}

export function AdminPagosTab({ reviews }: { reviews: PaymentReviewDTO[] }) {
  const groups = groupReviews(reviews)
  const pending = groups.filter((g) => g.status === 'pending')
  const reviewed = groups.filter((g) => g.status !== 'pending')

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <div className="border-b border-shell-line pb-3">
        <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Pagos</h2>
        <p className="text-xs text-slate-400">
          Coches inscritos en ligas de pago, uno por fila. Marca "Pagado" solo tras confirmar el pago fuera de la
          plataforma — hasta entonces ese coche no puede apuntarse a las carreras de la liga.
        </p>
      </div>

      <div className="overflow-x-auto border border-shell-line bg-black/10">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
              <th className="p-3">Equipo</th>
              <th className="p-3">Liga</th>
              <th className="p-3">Coche (clase / dorsal)</th>
              <th className="p-3">Inscrito</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-slate-300">
            {pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center italic text-slate-500">
                  No hay pagos pendientes de revisión.
                </td>
              </tr>
            ) : (
              pending.map((group) => <GroupRow key={group.key} group={group} />)
            )}
          </tbody>
        </table>
      </div>

      {reviewed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Revisados recientemente</p>
          <div className="overflow-x-auto border border-shell-line bg-black/10">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {reviewed.slice(0, 30).map((group) => (
                  <GroupRow key={group.key} group={group} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
