import { ClassBadge } from '@/components/class-badge'
import { updateRegistrationStatus } from '../actions/admin-registrations'
import type { PaymentReviewDTO } from '@/lib/data/registrations'

const STATUS_STYLES: Record<PaymentReviewDTO['status'], { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
  approved: { label: 'Aprobada', className: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' },
  waitlist: { label: 'Lista de espera', className: 'border-sky-500/40 bg-sky-950/40 text-sky-300' },
  rejected: { label: 'Rechazada', className: 'border-rose-500/40 bg-rose-950/40 text-rose-300' },
}

function PaymentRow({ review }: { review: PaymentReviewDTO }) {
  const status = STATUS_STYLES[review.status]

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="p-3 font-bold text-white">
        <span className="max-w-[160px] truncate">{review.displayName}</span>
        {review.teamName && <p className="mt-0.5 text-[11px] font-normal text-slate-400">{review.teamName}</p>}
      </td>
      <td className="p-3 text-xs text-slate-300">{review.leagueTitle}</td>
      <td className="p-3">
        {review.classTag && <ClassBadge classTag={review.classTag} className="text-[10px] font-black" />}
        {review.assignedNumber != null && (
          <span className="font-mono-data ml-1.5 shrink-0 rounded-md border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] px-2.5 py-1 text-sm font-black text-[#4ea1ff]">
            #{review.assignedNumber}
          </span>
        )}
      </td>
      <td className="p-3 font-mono text-xxs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</td>
      <td className="p-3">
        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
          {status.label}
        </span>
      </td>
      <td className="p-3 text-right">
        {review.status === 'pending' ? (
          <div className="flex items-center justify-end gap-1.5">
            <form action={updateRegistrationStatus}>
              <input type="hidden" name="registrationId" value={review.id} />
              <input type="hidden" name="leagueId" value={review.leagueId} />
              <input type="hidden" name="status" value="approved" />
              <input type="hidden" name="returnTo" value="/admin?tab=pagos&updated=1" />
              <button className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold uppercase text-emerald-400 transition-colors hover:bg-emerald-500/20">
                Aprobar
              </button>
            </form>
            <form action={updateRegistrationStatus}>
              <input type="hidden" name="registrationId" value={review.id} />
              <input type="hidden" name="leagueId" value={review.leagueId} />
              <input type="hidden" name="status" value="rejected" />
              <input type="hidden" name="returnTo" value="/admin?tab=pagos&updated=1" />
              <button className="rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[10px] font-bold uppercase text-rose-400 transition-colors hover:bg-rose-500/20">
                Rechazar
              </button>
            </form>
          </div>
        ) : (
          <span className="text-[10px] text-slate-500">—</span>
        )}
      </td>
    </tr>
  )
}

export function AdminPagosTab({ reviews }: { reviews: PaymentReviewDTO[] }) {
  const pending = reviews.filter((r) => r.status === 'pending')
  const reviewed = reviews.filter((r) => r.status !== 'pending')

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <div className="border-b border-shell-line pb-3">
        <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Pagos</h2>
        <p className="text-xs text-slate-400">
          Inscripciones a ligas de pago. Aprueba una fila solo tras confirmar el pago fuera de la plataforma —
          hasta entonces el piloto no cuenta como participante.
        </p>
      </div>

      <div className="overflow-x-auto border border-shell-line bg-black/10">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
              <th className="p-3">Piloto</th>
              <th className="p-3">Liga</th>
              <th className="p-3">Clase / Dorsal</th>
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
              pending.map((review) => <PaymentRow key={review.id} review={review} />)
            )}
          </tbody>
        </table>
      </div>

      {reviewed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Revisadas recientemente</p>
          <div className="overflow-x-auto border border-shell-line bg-black/10">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {reviewed.slice(0, 20).map((review) => (
                  <PaymentRow key={review.id} review={review} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
