'use client'

import { Lock, ScrollText, Wrench } from 'lucide-react'
import type { Campeonato, TicketType } from '@/lib/support-config'

// Reclamar y Dejar de reclamar son el mismo botón: cambia solo según el estado del ticket
// (se enseña "Reclamar" aquí, el que se ve nada más abrirse).
const CTL_BUTTONS = [
  { label: 'Reclamar', icon: Wrench, cls: 'bg-[#248046] text-white' },
  { label: 'Cerrar', icon: Lock, cls: 'bg-[#da373c] text-white' },
  { label: 'Transcribir', icon: ScrollText, cls: 'bg-[#4e5058] text-white' },
]

/** Vista previa del mensaje de bienvenida del ticket (Components V2: título + info + avatar a la derecha + botones de staff). */
export function TicketPreview({ color, welcomeMessage, types, campeonatos }: { color: string; welcomeMessage: string; types: TicketType[]; campeonatos: Campeonato[] }) {
  const sampleType = types[0]
  const sampleCampeonato = campeonatos[0]
  const welcome = (sampleType?.welcome || welcomeMessage || '').replace(/\{user\}/g, '@TuNombre') || 'Gracias por abrir un ticket, @TuNombre.'
  const code = `${(sampleType?.label || 'Ticket').toUpperCase()} 001`

  return (
    <div className="rounded-2xl border border-white/10 bg-[#313338] p-4 font-sans text-[#dbdee1] shadow-lg">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vista previa del ticket (Components V2)</p>

      <div className="overflow-hidden rounded-lg bg-[#2b2d31]" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-white">{code}</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#dbdee1]">{welcome}</p>
            <div className="mt-2 space-y-0.5 text-[13px] text-[#dbdee1]">
              {sampleCampeonato && (
                <p>
                  <span className="font-bold text-white">Campeonato:</span> {sampleCampeonato.emoji ? `${sampleCampeonato.emoji} ` : ''}
                  {sampleCampeonato.label}
                </p>
              )}
              <p>
                <span className="font-bold text-white">Categoría:</span> {sampleType?.label || 'Ticket'}
              </p>
              <p>
                <span className="font-bold text-white">Abierto por:</span> @TuNombre
              </p>
            </div>
          </div>
          <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-[#4e5058] to-[#2b2d31]" title="Foto de perfil de quien abre el ticket" />
        </div>

        {sampleType?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de una imagen externa arbitraria, no de /public
          <img src={sampleType.imageUrl} alt="" className="max-h-64 w-full object-contain px-3 pb-2" />
        )}

        <div className="border-t border-black/20 p-3">
          <div className="flex flex-wrap gap-1.5">
            {CTL_BUTTONS.map((b) => (
              <span key={b.label} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium ${b.cls}`}>
                <b.icon className="h-3.5 w-3.5" />
                {b.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#949ba4]">Gestiona este ticket desde /soporte en el Hub · botones solo para staff</p>
        </div>
      </div>
    </div>
  )
}
