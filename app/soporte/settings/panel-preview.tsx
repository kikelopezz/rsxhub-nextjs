'use client'

import type { Campeonato, TicketType } from '@/lib/support-config'

export function PanelPreview({
  title,
  description,
  color,
  panelStyle,
  types,
  campeonatos,
}: {
  title: string
  description: string
  color: string
  panelStyle: 'menu' | 'buttons'
  types: TicketType[]
  campeonatos: Campeonato[]
}) {
  const primary: Array<{ id: string; emoji: string; label: string }> =
    campeonatos.length > 0 ? [...campeonatos, { id: '__general__', emoji: '📁', label: 'General' }] : types

  return (
    <div className="rounded-2xl border border-white/10 bg-[#313338] p-4 font-sans text-[#dbdee1] shadow-lg">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vista previa del panel</p>
      <div className="overflow-hidden rounded-lg bg-[#2b2d31]" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="p-3">
          <p className="text-[15px] font-bold text-white">{title || 'Soporte'}</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#dbdee1]">{description}</p>
        </div>
      </div>

      <div className="mt-2">
        {primary.length === 0 ? (
          <p className="text-[11px] italic text-slate-500">Añade al menos una categoría de ticket para que el panel tenga opciones.</p>
        ) : panelStyle === 'buttons' ? (
          <div className="flex flex-wrap gap-1.5">
            {primary.map((p) => (
              <span key={p.id} className="rounded bg-[#4e5058] px-3 py-1.5 text-[13px] font-medium text-white">
                {p.emoji ? `${p.emoji} ` : ''}
                {p.label || 'Categoría'}
              </span>
            ))}
          </div>
        ) : (
          <div className="w-64 rounded border border-[#1e1f22] bg-[#1e1f22] px-3 py-2 text-[13px] text-[#949ba4]">
            {campeonatos.length > 0 ? 'Elige un campeonato ▾' : 'Elige una categoría ▾'}
          </div>
        )}
      </div>

      {campeonatos.length > 0 && types.length > 0 && (
        <p className="mt-2 text-[11px] italic text-slate-500">
          Tras elegir campeonato, se pregunta la categoría: {types.map((t) => t.label || 'Categoría').join(', ')}.
        </p>
      )}
    </div>
  )
}
