'use client'

import React, { useState, useMemo } from 'react'
import { FolderDown, X, Check, Copy } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
import { carLineupKey } from '@/lib/car-key'
import type { LeagueEvent, EventConfirmation, Registration, ManagedTeam, TeamStanding } from '../hooks/use-league-state'
import {
  resolveTeamName as _resolveTeamName,
  resolveCarSkin as _resolveCarSkin,
  resolveCarModelFolder as _resolveCarModelFolder,
  resolveDrivers as _resolveDrivers,
  buildCategorySkinZip,
} from './entry-list-utils'
import { useDictionary } from '@/lib/i18n/locale-provider'

type EventEntryListModalProps = {
  event: LeagueEvent
  confirmations: EventConfirmation[]
  registrations: Registration[]
  classTags: string[]
  myManagedTeams: ManagedTeam[]
  teamInfo?: Record<string, { name: string; primaryColor: string | null; logoUrl: string | null; cars?: any[]; members?: any[]; skinAssignments?: any[] }>
  standings?: Record<string, TeamStanding[]>
  skinReviewStatus?: Record<string, 'pending' | 'approved' | 'rejected'>
  isAdmin: boolean
  onClose: () => void
}

export function EventEntryListModal({
  event,
  confirmations,
  registrations,
  classTags,
  myManagedTeams,
  teamInfo = {},
  standings,
  skinReviewStatus = {},
  isAdmin,
  onClose,
}: EventEntryListModalProps) {
  const tr = useDictionary().ligas.entryList
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set())
  const [downloadingCategory, setDownloadingCategory] = useState<string | null>(null)

  const allTeamsInStandings = useMemo(() => {
    if (!standings) return []
    const list: Array<{ id: string; name: string }> = []
    Object.values(standings).forEach((catTeams) => {
      catTeams.forEach((t) => {
        if (!list.some((existing) => existing.id === t.id)) {
          list.push({ id: t.id, name: t.name })
        }
      })
    })
    return list
  }, [standings])

  const resolveTeamName = (teamId: string) =>
    _resolveTeamName(teamId, myManagedTeams, allTeamsInStandings, teamInfo)

  const resolveCarSkin = (teamId: string, classTag: string, dorsal: string) =>
    _resolveCarSkin(teamId, classTag, dorsal, myManagedTeams, teamInfo)

  const resolveCarModelFolder = (teamId: string, classTag: string, dorsal: string) =>
    _resolveCarModelFolder(teamId, classTag, dorsal, myManagedTeams, teamInfo)

  const resolveDrivers = (teamId: string, classTag: string, carNumber: string | number) =>
    _resolveDrivers(teamId, classTag, carNumber, event.leagueId, myManagedTeams, teamInfo, registrations)



  const groupedConfirmations = useMemo(() => {
    const map: Record<string, Array<{ teamId: string; teamName: string; dorsal: string; drivers: Array<{ name: string; steamId: string }> }>> = {}

    classTags.forEach((tag) => {
      map[tag] = []
    })

    confirmations.forEach((c) => {
      const tag = String(c.classTag || '').toUpperCase()
      if (registrations && registrations.length > 0) {
        const isReg = registrations.some(
          (r) => (r.teamId ? r.teamId === c.teamId : r.userId === (c as any).userId) && String(r.classTag || '').toUpperCase() === tag
        )
        if (!isReg) return
      }

      const dorsal = String((c as any).dorsalDisplay || c.carNumber || '')
      const teamName = resolveTeamName(c.teamId)
      const drivers = resolveDrivers(c.teamId, tag, c.carNumber)

      if (!map[tag]) map[tag] = []

      if (!map[tag].some((item) => item.teamId === c.teamId && item.dorsal === dorsal)) {
        map[tag].push({
          teamId: c.teamId,
          teamName,
          dorsal,
          drivers,
        })
      }
    })

    return map
  }, [confirmations, classTags, myManagedTeams, registrations, allTeamsInStandings, teamInfo])

  const handleDownloadCategorySkins = async (tag: string, teamList: Array<{ teamId: string; teamName: string; dorsal: string }>) => {
    setDownloadingCategory(tag)
    try {
      // Only bundle skins an admin has actually approved — an unreviewed or rejected file
      // has no business going into the server's content pack for race night.
      const approvedTeamList = teamList.filter(
        (t) => skinReviewStatus[carLineupKey(t.teamId, tag, event.leagueId, t.dorsal)] === 'approved'
      )
      const { blob: content, count: downloadedCount } = await buildCategorySkinZip(tag, approvedTeamList, myManagedTeams, teamInfo)

      if (downloadedCount === 0) {
        alert(tr.noSkinsFound.replace('{tag}', tag))
        return
      }

      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = `Skins_Confirmed_${tag}_Round.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error generating skins zip bundle:', err)
      alert(tr.zipError)
    } finally {
      setDownloadingCategory(null)
    }
  }




  const totalConfirmed = confirmations.length

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm md:items-center">
      <div className="relative my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f18] shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/30 p-4 md:p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-data rounded border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4ea1ff]">
                {event.circuitName}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {totalConfirmed} {totalConfirmed === 1 ? tr.confirmedTeamOne : tr.confirmedTeamMany}
              </span>
            </div>
            <h2 className="font-display-league mt-1.5 text-xl uppercase text-white md:text-2xl">
              {event.title || tr.round.replace('{circuit}', event.circuitName)}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-4 md:p-6">
          {totalConfirmed === 0 ? (
            <div className="py-8 text-center text-sm font-medium text-slate-400">
              {tr.noConfirmedTeams}
            </div>
          ) : (
            Object.entries(groupedConfirmations).map(([tag, teamList]) => {
              if (teamList.length === 0) return null

              return (
                <div key={tag} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                    <div className="flex items-center gap-2">
                      <ClassBadge classTag={tag} className="text-xs font-black" />
                      <span className="text-xs font-bold uppercase text-slate-400">
                        ({teamList.length} {teamList.length === 1 ? tr.teamOne : tr.teamMany})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadCategorySkins(tag, teamList)}
                      disabled={downloadingCategory === tag}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        downloadingCategory === tag
                          ? 'animate-pulse border-[#4ea1ff]/50 bg-[rgba(78,161,255,.15)] text-[#4ea1ff]'
                          : 'border-[#4ea1ff]/30 bg-[rgba(78,161,255,.08)] text-[#4ea1ff] hover:bg-[rgba(78,161,255,.18)] hover:text-white'
                      }`}
                      title={tr.downloadSkinsTitle.replace('{tag}', tag)}
                    >
                      <FolderDown className="h-3.5 w-3.5" />
                      {downloadingCategory === tag ? tr.bundlingSkins : tr.downloadSkins.replace('{tag}', tag)}
                    </button>
                  </div>

                  <div className="grid gap-2">
                    {teamList.map((t, idx) => {
                      const rowKey = `${tag}_${t.teamId}_${t.dorsal}_${idx}`
                      const skinUrl = resolveCarSkin(t.teamId, tag, t.dorsal)
                      const skinStatus = skinUrl
                        ? skinReviewStatus[carLineupKey(t.teamId, tag, event.leagueId, t.dorsal)]
                        : undefined

                      return (
                        <div
                          key={rowKey}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-3 transition-colors hover:border-[#4ea1ff]/40"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="font-mono-data shrink-0 rounded-md border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] px-2.5 py-1 text-sm font-black text-[#4ea1ff]">
                              #{t.dorsal}
                            </span>
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-bold uppercase tracking-wide text-white">
                                {t.teamName}
                              </h4>
                              {t.drivers.length > 0 && (
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                  {t.drivers.map((d, dIdx) => (
                                    <span key={dIdx} className="font-medium text-slate-300">
                                      {d.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  const ids = t.drivers
                                    .map((d) => d.steamId)
                                    .filter((id) => Boolean(id) && /^\d{15,18}$/.test(id))
                                  const copyText = ids.join(';')
                                  if (copyText) {
                                    navigator.clipboard.writeText(copyText)
                                    setCopiedKeys((prev) => new Set(prev).add(rowKey))
                                  } else {
                                    alert(tr.noSteamIds)
                                  }
                                }}
                                className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                  copiedKeys.has(rowKey)
                                    ? 'border-[#4ea1ff]/40 bg-[rgba(78,161,255,.08)] text-[#4ea1ff] hover:bg-[rgba(78,161,255,.18)]'
                                    : 'animate-pulse border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-950/60'
                                }`}
                                title={tr.copyIdsTitle.replace('{dorsal}', t.dorsal)}
                              >
                                {copiedKeys.has(rowKey) ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    <span>{tr.copied}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>{tr.copyIds}</span>
                                  </>
                                )}
                              </button>
                            )}

                            {!skinUrl ? (
                              <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400">
                                {tr.noSkin}
                              </span>
                            ) : skinStatus === 'approved' ? (
                              <span className="flex items-center gap-1 rounded-full border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4ea1ff]">
                                <Check className="h-3 w-3" />
                                {tr.skinOk}
                              </span>
                            ) : skinStatus === 'rejected' ? (
                              <span className="rounded-full border border-rose-500/40 bg-rose-950/40 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-400">
                                {tr.skinRejected}
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                                {tr.skinPending}
                              </span>
                            )}

                            <span className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                              {tr.confirmed}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
