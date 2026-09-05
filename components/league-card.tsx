'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { League } from '@/types'
import { ClassBadge } from '@/components/class-badge'

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  open: { bg: 'rgba(34,197,94,.16)', text: '#4ade80' },
  ongoing: { bg: 'rgba(78,161,255,.16)', text: '#4ea1ff' },
  finished: { bg: 'rgba(255,255,255,.08)', text: '#8b96a8' },
}

export function LeagueCard({
  league,
  registeredCount = 0,
}: {
  league: League & { leader?: { name: string; logoUrl: string | null; points: number } | null }
  registeredCount?: number
}) {
  const classes = Array.from(new Set((league.classTags || []).map((tag) => tag.trim().toUpperCase()))).slice(0, 4)
  const simLogo = league.simulator === 'ac' ? '/branding/ACLogo.png' : '/branding/LMULogo.png'
  const simLabel = league.simulator === 'ac' ? 'AC' : 'LMU'
  const accentHex = league.accentColor || '#1274de'
  const statusKey = league.status === 'open' && !league.registrationOpen ? 'ongoing' : (league.status || 'open')
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.open
  const statusLabel = league.registrationOpen
    ? 'Inscripciones abiertas'
    : statusKey === 'finished'
      ? 'Finalizada'
      : 'En curso'
  const leader = league.leader

  const initials = league.title.slice(0, 2).toUpperCase()

  return (
    <Link href={`/ligas/${league.slug}`} className="group block h-full">
      <article
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--glow)] hover:shadow-[0_18px_44px_-12px_var(--glow)]"
        style={{ '--glow': `${accentHex}88` } as CSSProperties}
      >
        {/* Header band: real preview photo when set, diagonal accent split when not */}
        <div
          className="relative flex h-40 flex-col justify-between overflow-hidden p-4"
          style={
            league.logoUrl
              ? undefined
              : { background: `linear-gradient(160deg, ${accentHex} 0%, ${accentHex} 42%, #0a0a0c 42.5%, #0a0a0c 100%)` }
          }
        >
          {league.logoUrl && (
            <Image
              src={league.logoUrl}
              alt={league.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] from-10% via-[#0a0a0c]/50 via-45% to-transparent" />
          <span className="pointer-events-none absolute -right-2 -top-7 select-none font-display-league text-[110px] leading-none text-white/10">
            {initials}
          </span>

          <span className="absolute right-3 top-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-md">
            <Image src={simLogo} alt={simLabel} width={40} height={40} className="h-full w-full object-contain" />
          </span>

          <div className="relative flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider backdrop-blur-sm"
              style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.text}55` }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="relative">
            <h3 className="font-display-league truncate text-[26px] leading-[0.95] text-white [text-shadow:0_2px_10px_rgba(0,0,0,.5)]">
              {league.title}
            </h3>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          {classes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {classes.map((tag) => (
                <ClassBadge key={tag} classTag={tag} />
              ))}
            </div>
          )}

          {/* Leader preview — the card's reason for being: who's winning right now */}
          <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
            {leader ? (
              <>
                <span className="font-display-league w-5 text-center text-lg text-[#f5c518]">P1</span>
                {leader.logoUrl ? (
                  <Image src={leader.logoUrl} alt={leader.name} width={28} height={28} className="h-7 w-7 shrink-0 rounded-md border border-white/15 bg-[#0d1420] object-contain" />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-[#0d1420] text-[10px] font-black text-slate-300">
                    {leader.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{leader.name}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Líder actual</p>
                </div>
                <span className="font-mono-data text-sm font-bold text-[#4ea1ff]">{leader.points}</span>
              </>
            ) : (
              <p className="w-full py-1 text-center text-[11px] italic text-slate-500">Aún sin resultados</p>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between text-[10px] text-slate-500">
            <span className="font-mono-data">{registeredCount} {registeredCount === 1 ? 'equipo inscrito' : 'equipos inscritos'}</span>
            <span className="font-bold uppercase tracking-wider text-[#4ea1ff] transition-transform group-hover:translate-x-0.5">Ver campeonato →</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
