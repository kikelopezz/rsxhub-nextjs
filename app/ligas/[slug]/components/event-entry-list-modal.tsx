'use client'

import React, { useState, useMemo } from 'react'
import { FolderDown, X, Check, Copy } from 'lucide-react'
import { ClassBadge } from '@/components/class-badge'
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
  isAdmin,
  onClose,
}: EventEntryListModalProps) {
  const tr = useDictionary().ligas.entryList
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
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
      const { blob: content, count: downloadedCount } = await buildCategorySkinZip(tag, teamList, myManagedTeams, teamInfo)

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
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 flex justify-center items-start md:items-center">
      <div className="w-full max-w-2xl bg-[#090d16] border border-shell-line shadow-2xl my-auto relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-shell-line p-4 md:p-5 bg-black/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
                {event.circuitName}
              </span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {totalConfirmed} {totalConfirmed === 1 ? tr.confirmedTeamOne : tr.confirmedTeamMany}
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-white mt-1">
              {event.title || tr.round.replace('{circuit}', event.circuitName)}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {totalConfirmed === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm font-medium">
              {tr.noConfirmedTeams}
            </div>
          ) : (
            Object.entries(groupedConfirmations).map(([tag, teamList]) => {
              if (teamList.length === 0) return null

              return (
                <div key={tag} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ClassBadge classTag={tag} className="text-xs font-black" />
                      <span className="text-xs text-slate-400 font-bold uppercase">
                        ({teamList.length} {teamList.length === 1 ? tr.teamOne : tr.teamMany})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadCategorySkins(tag, teamList)}
                      disabled={downloadingCategory === tag}
                      className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider border rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                        downloadingCategory === tag
                          ? 'border-cyan-500/50 bg-cyan-950/60 text-cyan-300 animate-pulse'
                          : 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white'
                      }`}
                      title={tr.downloadSkinsTitle.replace('{tag}', tag)}
                    >
                      <FolderDown className="h-3.5 w-3.5 text-cyan-400" />
                      {downloadingCategory === tag ? tr.bundlingSkins : tr.downloadSkins.replace('{tag}', tag)}
                    </button>
                  </div>

                  <div className="grid gap-2">
                    {teamList.map((t, idx) => {
                      const rowKey = `${tag}_${t.teamId}_${t.dorsal}_${idx}`
                      const skinUrl = resolveCarSkin(t.teamId, tag, t.dorsal)

                      return (
                        <div
                          key={rowKey}
                          className="flex flex-wrap items-center justify-between gap-3 bg-black/40 border border-slate-800 p-3 hover:border-cyan-500/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-sm font-black text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 shrink-0">
                              #{t.dorsal}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white uppercase tracking-wide truncate">
                                {t.teamName}
                              </h4>
                              {t.drivers.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                  {t.drivers.map((d, dIdx) => (
                                    <span key={dIdx} className="text-slate-300 font-medium">
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
                                  const copyText = ids.join(', ')
                                  if (copyText) {
                                    navigator.clipboard.writeText(copyText)
                                    setCopiedKey(rowKey)
                                    setTimeout(() => setCopiedKey(null), 2200)
                                  } else {
                                    alert(tr.noSteamIds)
                                  }
                                }}
                                className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                title={tr.copyIdsTitle.replace('{dorsal}', t.dorsal)}
                              >
                                {copiedKey === rowKey ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-400" />
                                    <span className="text-emerald-400">{tr.copied}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 text-cyan-400" />
                                    <span>{tr.copyIds}</span>
                                  </>
                                )}
                              </button>
                            )}

                            {skinUrl ? (
                              <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center gap-1">
                                <Check className="h-3 w-3 text-cyan-400" />
                                {tr.skinOk}
                              </span>
                            ) : (
                              <span className="bg-slate-900 text-slate-400 border border-slate-700/60 text-[10px] font-bold uppercase px-2 py-0.5">
                                {tr.noSkin}
                              </span>
                            )}

                            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase px-2 py-0.5">
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
