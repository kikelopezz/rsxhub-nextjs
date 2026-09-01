'use client'

type CopyableSteamIdProps = {
  steamId: string
}

export function CopyableSteamId({ steamId }: CopyableSteamIdProps) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(steamId)
    alert(`Copiado: ${steamId}`)
  }

  return (
    <span
      onClick={handleCopy}
      title="Click para copiar Steam ID"
      className="text-[9px] text-cyan-400/80 hover:text-cyan-300 font-mono cursor-pointer border border-cyan-500/20 px-1 py-0.5 bg-cyan-950/30 transition-all select-all flex items-center gap-0.5 shrink-0"
    >
      {steamId}
    </span>
  )
}
