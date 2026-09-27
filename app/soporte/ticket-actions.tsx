'use client'

import { useState } from 'react'
import { SubmitButton } from '@/components/submit-button'
import { ConfirmForm } from '@/components/confirm-form'
import {
  claimTicketAction,
  unclaimTicketAction,
  closeTicketAction,
  reopenTicketAction,
  mergeTicketAction,
  deleteTicketAction,
  saveTicketNotesAction,
} from './actions'

type TicketLite = { id: string; code: string; status: string }

const inputCls =
  'w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]'
const btnCls = (color: string) =>
  `rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${color}`

export function TicketActions({
  ticket,
  guildId,
  returnStatus,
  mergeTargets,
  initialNotes,
}: {
  ticket: { id: string; status: string; internalNotes: string | null }
  guildId: string
  returnStatus: string
  mergeTargets: TicketLite[]
  initialNotes: string
}) {
  const [notes, setNotes] = useState(initialNotes)
  const hidden = (
    <>
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="ticketId" value={ticket.id} />
      <input type="hidden" name="returnStatus" value={returnStatus} />
    </>
  )

  return (
    <div className="space-y-4 border-t border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap gap-2">
        {ticket.status === 'open' && (
          <form action={claimTicketAction}>
            {hidden}
            <SubmitButton className={btnCls('border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20')} label="Reclamar" pendingLabel="Reclamando…" />
          </form>
        )}
        {ticket.status === 'claimed' && (
          <form action={unclaimTicketAction}>
            {hidden}
            <SubmitButton className={btnCls('border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20')} label="Dejar de reclamar" pendingLabel="…" />
          </form>
        )}
        {(ticket.status === 'open' || ticket.status === 'claimed') && (
          <form action={closeTicketAction} className="flex items-center gap-2">
            {hidden}
            <input name="reason" placeholder="Motivo (opcional)" maxLength={200} className={`${inputCls} w-44`} />
            <SubmitButton className={btnCls('border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20')} label="Cerrar" pendingLabel="Cerrando…" />
          </form>
        )}
        {ticket.status === 'closed' && (
          <form action={reopenTicketAction}>
            {hidden}
            <SubmitButton className={btnCls('border-[#4ea1ff]/40 bg-[#4ea1ff]/10 text-[#4ea1ff] hover:bg-[#4ea1ff]/20')} label="Reabrir" pendingLabel="…" />
          </form>
        )}
        {(ticket.status === 'open' || ticket.status === 'claimed') && mergeTargets.length > 0 && (
          <form action={mergeTicketAction} className="flex items-center gap-2">
            {hidden}
            <select name="targetTicketId" className={`${inputCls} w-44`} defaultValue="">
              <option value="" disabled>
                Fusionar con…
              </option>
              {mergeTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
            <SubmitButton className={btnCls('border-white/15 bg-white/5 text-slate-300 hover:bg-white/10')} label="Fusionar" pendingLabel="…" />
          </form>
        )}
        <ConfirmForm action={deleteTicketAction} confirmMessage="¿Borrar este ticket y su canal de Discord? No se puede deshacer.">
          {hidden}
          <SubmitButton className={btnCls('border-white/10 bg-transparent text-slate-500 hover:border-rose-400/40 hover:text-rose-300')} label="Eliminar" pendingLabel="Eliminando…" />
        </ConfirmForm>
      </div>

      <form action={saveTicketNotesAction} className="space-y-1.5">
        {hidden}
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Notas internas (solo staff)</label>
        <textarea
          name="notes"
          rows={2}
          maxLength={4000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputCls}
          placeholder="Contexto, decisiones tomadas, enlaces…"
        />
        <SubmitButton className={btnCls('border-white/15 bg-white/5 text-slate-300 hover:bg-white/10')} label="Guardar notas" pendingLabel="Guardando…" />
      </form>
    </div>
  )
}
