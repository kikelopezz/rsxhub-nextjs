const STEP_LABELS = ['Abierto', 'Reclamado', 'Cerrado'] as const

type TicketProgress = {
  status: string
  createdAt: Date
  claimedAt: Date | null
  claimedByTag: string | null
  closedAt: Date | null
  closedByTag: string | null
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function currentStepIndex(status: string) {
  return status === 'closed' ? 2 : status === 'claimed' ? 1 : 0
}

/** Barra de pasos del ciclo de vida del ticket (Abierto → Reclamado → Cerrado). Reabrir y fusionar son
 * acciones aparte, no pasos del camino: un ticket fusionado se enseña con una nota en vez de la barra. */
export function StatusSteps({ ticket, mode = 'full' }: { ticket: TicketProgress; mode?: 'full' | 'compact' }) {
  if (ticket.status === 'merged') {
    return (
      <div className={`flex items-center gap-1.5 text-[#4ea1ff] ${mode === 'compact' ? 'text-[10px]' : 'text-xs'}`}>
        <span>🔀</span>
        <span>Fusionado con otro ticket</span>
      </div>
    )
  }

  const current = currentStepIndex(ticket.status)
  const at = [ticket.createdAt, ticket.claimedAt, ticket.closedAt]
  const who = [null, ticket.claimedByTag, ticket.closedByTag]

  if (mode === 'compact') {
    return (
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((_, i) => (
          <span key={i} className="flex items-center">
            <span className={`h-2 w-2 rounded-full ${i <= current ? 'bg-[#4ea1ff]' : 'bg-white/15'}`} />
            {i < STEP_LABELS.length - 1 && <span className={`h-px w-3.5 ${i < current ? 'bg-[#4ea1ff]' : 'bg-white/15'}`} />}
          </span>
        ))}
        <span className="ml-1.5 text-[10px] text-slate-500">{STEP_LABELS[current].toLowerCase()}</span>
      </div>
    )
  }

  return (
    <div className="flex items-start">
      {STEP_LABELS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending'
        return (
          <div key={label} className="flex items-start" style={{ flex: i === STEP_LABELS.length - 1 ? '0 0 auto' : '1 1 0%' }}>
            <div className="flex w-[110px] flex-col items-center gap-1.5 text-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm ${
                  state === 'pending'
                    ? 'border-white/15 bg-white/5 text-slate-600'
                    : state === 'current'
                      ? 'border-[#4ea1ff] bg-[#4ea1ff]/15 text-[#4ea1ff]'
                      : 'border-[#4ea1ff] bg-[#4ea1ff] text-[#0a0a0c] font-bold'
                }`}
              >
                {state === 'done' ? '✓' : i + 1}
              </div>
              <span className={`font-display-condensed text-[11px] font-bold uppercase tracking-wide ${state === 'pending' ? 'text-slate-600' : state === 'current' ? 'text-[#4ea1ff]' : 'text-white'}`}>
                {label}
              </span>
              {at[i] && (
                <span className="text-[10px] text-slate-500">
                  {who[i] ? `${who[i]} · ` : ''}
                  {formatDateTime(at[i]!)}
                </span>
              )}
            </div>
            {i < STEP_LABELS.length - 1 && <div className={`mt-4 h-0.5 flex-grow ${i < current ? 'bg-[#4ea1ff]' : 'bg-white/15'}`} />}
          </div>
        )
      })}
    </div>
  )
}
