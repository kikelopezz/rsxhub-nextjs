import { Loader2 } from 'lucide-react'

export default function GlobalLoading() {
  return (
    <div className="w-full py-16 flex flex-col items-center justify-center space-y-3 animate-pulse">
      <div className="flex items-center gap-2.5 bg-[#090d16] border border-cyan-500/40 px-5 py-3 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
        <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
          Loading Page...
        </span>
      </div>
    </div>
  )
}
