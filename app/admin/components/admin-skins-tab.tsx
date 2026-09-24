'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileArchive, CheckCircle2, XCircle, Download, Clock } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { getSkinFileName } from '@/components/team-cars-editor/types'
import { approveCarSkinAction, rejectCarSkinAction } from '../actions/admin-skin-review'
import type { SkinReviewDTO } from '@/lib/team-data'

const STATUS_STYLES: Record<SkinReviewDTO['status'], { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
  approved: { label: 'Aprobada', className: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' },
  rejected: { label: 'Rechazada', className: 'border-rose-500/40 bg-rose-950/40 text-rose-300' },
}

function SkinRow({ review }: { review: SkinReviewDTO }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const handleReview = async (action: typeof approveCarSkinAction, kind: 'approve' | 'reject') => {
    setIsSubmitting(kind)
    try {
      const formData = new FormData()
      formData.set('reviewId', review.id)
      if (kind === 'reject') formData.set('reason', reason.trim())
      const res = await action(formData)
      if (res && !res.success) {
        alert(res.error || 'No se pudo actualizar la skin.')
        return
      }
      setRejecting(false)
      setReason('')
      router.refresh()
    } finally {
      setIsSubmitting(null)
    }
  }

  const status = STATUS_STYLES[review.status]

  return (
    <>
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="flex items-center gap-3 p-3 font-bold text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-shell-line bg-black/40">
          {review.teamLogoUrl ? (
            <Image src={review.teamLogoUrl} alt={review.teamName} width={36} height={36} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-black text-slate-500">{review.teamName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <span className="max-w-[160px] truncate">{review.teamName}</span>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <ClassBadge classTag={review.category} className="text-[10px] font-black" />
          <span className="font-mono-data shrink-0 rounded-md border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] px-2.5 py-1 text-sm font-black text-[#4ea1ff]">#{review.dorsal}</span>
        </div>
        <p className="mt-1 text-[11px] font-bold text-white">{review.carModel || <span className="font-normal italic text-slate-500">Coche sin indicar</span>}</p>
        {review.leagueTitle && <p className="mt-0.5 text-[10px] text-slate-500">{review.leagueTitle}</p>}
      </td>
      <td className="p-3">
        <a
          href={review.skinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
        >
          <FileArchive className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[180px] truncate">{getSkinFileName(review.skinUrl, review.skinName || undefined)}</span>
          <Download className="h-3 w-3 shrink-0" />
        </a>
      </td>
      <td className="p-3 font-mono text-xxs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</td>
      <td className="p-3">
        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.className}`}>
          {review.status === 'pending' && <Clock className="h-3 w-3" />}
          {status.label}
        </span>
      </td>
      <td className="p-3 text-right">
        {review.status === 'pending' ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => handleReview(approveCarSkinAction, 'approve')}
              disabled={isSubmitting !== null}
              title="Aprobar skin"
              className="rounded-md border border-emerald-500/40 bg-emerald-950/30 p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRejecting((v) => !v)}
              disabled={isSubmitting !== null}
              title="Rechazar skin"
              className="rounded-md border border-rose-500/40 bg-rose-950/30 p-1.5 text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-slate-500">
            {review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString() : '—'}
          </span>
        )}
      </td>
    </tr>
    {review.status === 'pending' && rejecting && (
      <tr className="bg-rose-950/10">
        <td colSpan={6} className="p-3">
          <div className="space-y-2 rounded-lg border border-rose-500/30 bg-black/40 p-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-rose-300">
              Motivo del rechazo (lo verá el equipo)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej: la skin no corresponde al BMW M4 GT3, falta el número de coche, textura corrupta…"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-rose-400/60"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRejecting(false); setReason('') }}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleReview(rejectCarSkinAction, 'reject')}
                disabled={isSubmitting !== null || reason.trim().length === 0}
                className="rounded-lg border border-rose-500/50 bg-rose-600/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-40 cursor-pointer"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </td>
      </tr>
    )}
    {review.status === 'rejected' && review.rejectReason && (
      <tr>
        <td colSpan={6} className="px-3 pb-3">
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-200">
            <span className="mr-1.5 font-black uppercase tracking-wider text-rose-300">Motivo:</span>
            {review.rejectReason}
          </div>
        </td>
      </tr>
    )}
    </>
  )
}

export function AdminSkinsTab({ reviews }: { reviews: SkinReviewDTO[] }) {
  const pending = reviews.filter((r) => r.status === 'pending')
  const reviewed = reviews.filter((r) => r.status !== 'pending')

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <div className="border-b border-shell-line pb-3">
        <h2 className="font-display-condensed text-sm font-bold uppercase tracking-wide text-white">Skins</h2>
        <p className="text-xs text-slate-400">
          Las skins subidas por los equipos deben aprobarse aquí antes de contar como entregadas en la entry list.
        </p>
      </div>

      <div className="overflow-x-auto border border-shell-line bg-black/10">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-shell-line bg-black/40 text-xxs font-black uppercase tracking-wider text-slate-400">
              <th className="p-3">Equipo</th>
              <th className="p-3">Coche</th>
              <th className="p-3">Archivo</th>
              <th className="p-3">Subida</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-slate-300">
            {pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center italic text-slate-500">
                  No hay skins pendientes de revisión.
                </td>
              </tr>
            ) : (
              pending.map((review) => <SkinRow key={review.id} review={review} />)
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
                  <SkinRow key={review.id} review={review} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
