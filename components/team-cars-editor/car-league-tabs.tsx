'use client'

import { Filter, Trophy } from 'lucide-react'
import type { CarEntry, LeagueOption } from './types'
import { useDictionary } from '@/lib/i18n/locale-provider'

type CarLeagueTabsProps = {
  cars: CarEntry[]
  leaguesOptions: LeagueOption[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export function CarLeagueTabs({ cars, leaguesOptions, activeTab, onTabChange }: CarLeagueTabsProps) {
  const t = useDictionary().equipos.carEditor
  return (
    <div className="bg-[#0f172a]/90 border border-slate-800/80 p-4 rounded-lg shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider font-extrabold text-cyan-400 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          {t.filterByLeague}
        </p>
        <span className="text-[11px] text-slate-400 font-mono font-bold">
          {cars.length} {t.totalVehicles}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onTabChange('all')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            activeTab === 'all'
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
              : 'bg-[#131d31]/60 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          <span>{t.allCars}</span>
          <span className="ml-1 bg-black/40 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {cars.length}
          </span>
        </button>
        {leaguesOptions.map((league) => {
          const count = cars.filter((c) => {
            if (c.leagueId) return c.leagueId === league.id || c.leagueId === league.slug
            if (league.classTags) return league.classTags.some((tag) => tag.toUpperCase() === c.category.toUpperCase())
            return false
          }).length
          const isSelected = activeTab === league.id || activeTab === league.slug
          return (
            <button
              key={league.id}
              type="button"
              onClick={() => onTabChange(league.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                  : 'bg-[#131d31]/60 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              <span>{league.title}</span>
              <span className="ml-1 bg-black/40 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
