import { Loader2 } from 'lucide-react'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function LoadingTeamPage() {
  const dict = getDictionary(await getLocale())
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Header Banner Skeleton */}
      <div className="shell-panel p-6 bg-[#090d16]/90 border border-shell-line space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-slate-800/80 rounded-lg shrink-0" />
            <div className="space-y-2">
              <div className="h-6 w-44 bg-slate-800/80 rounded-lg" />
              <div className="h-3 w-28 bg-slate-800/40 rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-cyan-950/40 border border-cyan-500/30 px-3.5 py-2 text-cyan-300">
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider">{dict.equipos.messages.loadingTeamData}</span>
          </div>
        </div>
      </div>

      {/* Grid Panels Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="shell-panel p-6 bg-[#090d16]/90 border border-shell-line h-64 flex items-center justify-center">
          <div className="h-4 w-32 bg-slate-800/50 rounded-lg" />
        </div>
        <div className="shell-panel p-6 bg-[#090d16]/90 border border-shell-line h-64 flex items-center justify-center">
          <div className="h-4 w-32 bg-slate-800/50 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
