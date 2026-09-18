// Se muestra al instante al entrar o cambiar de pestaña en Soporte, mientras el servidor pregunta al bot,
// para que la página no parezca colgada.
export default function SoporteLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-white/10 bg-[#0a0a0c]" />
        ))}
      </div>
      <div className="h-10 w-72 animate-pulse rounded-lg border border-shell-line bg-black/40" />
      <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
        ))}
      </div>
      <p className="text-center text-[11px] text-slate-500">Cargando tickets…</p>
    </div>
  )
}
