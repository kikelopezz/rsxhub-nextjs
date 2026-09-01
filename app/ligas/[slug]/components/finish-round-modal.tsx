'use client'

import { useState } from 'react'
import { X, Upload, FileText, BarChart3, CheckCircle2, AlertCircle, RefreshCw, Edit3, Eraser, Timer, Flag } from 'lucide-react'
import { ClassBadge, getCategoryStyles } from '@/components/class-badge'
import type { LeagueEvent } from '../hooks/use-league-state'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface FinishRoundModalProps {
  event: LeagueEvent
  initialSessionType?: 'qualifying' | 'race'
  leagueId: string
  classTags: string[]
  onClose: () => void
  onSuccess: () => void
}

export type ParsedRow = {
  id: string
  overallPos: number
  pos: number // Category Position
  driverName: string
  teamName: string
  steamId: string
  userId?: string
  classTag: string
  dorsal?: string | number
  points: number
  lapTime?: string
  raceTime?: string
}

const DEFAULT_POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

export function FinishRoundModal({
  event,
  initialSessionType,
  leagueId,
  classTags = ['GT3', 'LMP2'],
  onClose,
  onSuccess,
}: FinishRoundModalProps) {
  const tr = useDictionary().ligas.finishRound
  const hasQualy = Boolean(event.hasQualy === true || String(event.hasQualy) === 'true' || event.qualyStartsAt)
  const isQualyCompleted = Boolean((event as any).qualyCompleted || (event as any).qualy_completed)
  
  const [sessionType, setSessionType] = useState<'qualifying' | 'race'>(
    hasQualy ? (isQualyCompleted ? (initialSessionType || 'race') : 'qualifying') : 'race'
  )
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [jsonText, setJsonText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Handle JSON file selection or text input parsing
  const handleParseJson = (rawContent: string) => {
    try {
      setErrorMsg('')
      const parsed = JSON.parse(rawContent)
      let rawList: any[] = []

      if (Array.isArray(parsed)) {
        rawList = parsed
      } else if (Array.isArray(parsed.Result)) {
        rawList = parsed.Result
      } else if (Array.isArray(parsed.results)) {
        rawList = parsed.results
      } else if (Array.isArray(parsed.Cars)) {
        rawList = parsed.Cars
      }

      if (rawList.length === 0) {
        throw new Error(tr.noValidRows)
      }

      // Track positions per class tag
      const classCounters: Record<string, number> = {}

      const rows: ParsedRow[] = rawList.map((item, idx) => {
        const overallPos = item.position || item.pos || idx + 1
        const driverName =
          item.DriverName ||
          item.driverName ||
          item.Driver?.Name ||
          item.driver?.name ||
          item.name ||
          `Driver ${idx + 1}`

        let rawTeamName = item.TeamName || item.teamName || item.Driver?.Team || driverName
        let cleanTeamName = rawTeamName.split('|')[0].trim() || rawTeamName.trim()

        const steamId =
          item.DriverGuid || item.driverGuid || item.Driver?.Guid || item.guid || `76561198000000${idx + 1}`
        const userId = item.userId || item.user_id

        const rawDorsal = item.carNumber ?? item.CarNumber ?? item.Driver?.CarNumber ?? item.ballast
        const dorsalDisplay = rawDorsal != null ? String(rawDorsal).trim() : String((idx % 90) + 1)

        // Determine category tag
        let classTag = item.classTag || item.ClassTag || item.CarModel || item.carModel || ''
        if (!classTag || !classTags.includes(classTag)) {
          classTag = classTags[idx % classTags.length] || 'GT3'
        }

        // Increment category position counter
        classCounters[classTag] = (classCounters[classTag] || 0) + 1
        const catPos = item.pos != null ? item.pos : classCounters[classTag]

        // Calculate points based on category position unless points are explicitly specified
        const points = sessionType === 'qualifying'
          ? 0
          : (typeof item.points === 'number'
              ? item.points
              : DEFAULT_POINTS_SYSTEM[catPos - 1] || (catPos <= 15 ? 1 : 0))

        const lapTime = item.bestLap || item.lapTime || item.BestLap || null
        const raceTime = item.totalTime || item.raceTime || item.TotalTime || null

        return {
          id: `${steamId}_${idx}`,
          overallPos,
          pos: catPos,
          driverName,
          teamName: cleanTeamName,
          steamId,
          userId,
          classTag,
          dorsal: dorsalDisplay,
          points,
          lapTime,
          raceTime,
        }
      })

      setParsedRows(rows)
      setActiveTab('preview')
    } catch (err: any) {
      setErrorMsg(err.message || tr.parseError)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setJsonText(text)
        handleParseJson(text)
      }
      reader.readAsText(selectedFile)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setJsonText(text)
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      handleParseJson(text)
    }
  }

  // Update Row Position
  const handleUpdateRowPos = (rowId: string, newPos: number) => {
    setParsedRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, pos: Math.max(1, newPos) } : row))
    )
  }

  // Update Row Points
  const handleUpdateRowPoints = (rowId: string, newPoints: number) => {
    setParsedRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, points: Math.max(0, newPoints) } : row))
    )
  }

  // Clear all points (set to 0)
  const handleClearPoints = () => {
    setParsedRows((prev) => prev.map((row) => ({ ...row, points: 0 })))
  }

  // Recalculate Points automatically based on Category Position
  const handleRecalculatePoints = () => {
    setParsedRows((prev) =>
      prev.map((row) => ({
        ...row,
        points: DEFAULT_POINTS_SYSTEM[row.pos - 1] || (row.pos <= 15 ? 1 : 0),
      }))
    )
  }

  // Submit Final Results
  const handleSubmit = async () => {
    if (parsedRows.length === 0) {
      setErrorMsg(tr.noRows)
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const formattedResultsPayload = {
        eventId: event.id,
        sessionType,
        results: parsedRows.map((r) => ({
          DriverGuid: r.steamId,
          userId: r.userId,
          position: r.pos,
          overallPosition: r.overallPos,
          carNumber: r.dorsal,
          driverName: r.driverName,
          teamName: r.teamName,
          points: r.points,
          classTag: r.classTag,
          lapTime: r.lapTime,
          raceTime: r.raceTime,
        })),
      }

      const formData = new FormData()
      formData.append('leagueId', leagueId)
      formData.append('eventId', event.id)
      formData.append('sessionType', sessionType)
      formData.append('replaceExisting', 'on')
      formData.append('resultsJsonText', JSON.stringify(formattedResultsPayload))

      const res = await fetch('/api/admin/import-results', {
        method: 'POST',
        body: formData,
      })

      if (res.ok || res.redirected) {
        onSuccess()
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.message || tr.saveError)
      }
    } catch (err: any) {
      setErrorMsg(err.message || tr.connectionError)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter & Group rows by Category Tag
  const availableCategories = Array.from(new Set(parsedRows.map((r) => r.classTag)))
  const displayCategories =
    selectedCategoryFilter === 'ALL'
      ? availableCategories.length > 0
        ? availableCategories
        : classTags
      : [selectedCategoryFilter]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-4 md:p-6 flex justify-center items-start sm:items-center animate-fade-in">
      <div className="shell-panel border border-shell-line bg-[#090d16] max-w-4xl w-full p-5 md:p-6 text-white rounded-lg shadow-[0_0_60px_rgba(0,0,0,0.9)] relative flex flex-col my-auto">
        {/* Modal Header */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-shell-line pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase">
              {tr.roundManagement}
            </span>
            <h2 className="text-xl font-bold uppercase text-white tracking-tight">
              {tr.finalizeRound.replace('{round}', event.title || event.circuitName)}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {tr.uploadHint}
          </p>
        </div>

        {/* Top Session Type Selector (Qualifying vs Race) - Only shown when round has Qualy */}
        {hasQualy && (
          <div className="grid grid-cols-2 gap-2 bg-black/60 p-1.5 border border-shell-line/60 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => {
                setSessionType('qualifying')
                setParsedRows((prev) => prev.map((r) => ({ ...r, points: 0 })))
              }}
              className={`py-2 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                sessionType === 'qualifying'
                  ? 'bg-cyan-500 text-black shadow-md border border-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Timer className="h-4 w-4" />
              {tr.qualifyingSession} {isQualyCompleted ? '✓' : tr.phase1}
            </button>
            <button
              type="button"
              disabled={!isQualyCompleted}
              onClick={() => {
                if (isQualyCompleted) setSessionType('race')
              }}
              className={`py-2 text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                !isQualyCompleted
                  ? 'text-slate-600 bg-black/40 border border-white/5 cursor-not-allowed'
                  : sessionType === 'race'
                  ? 'bg-amber-500 text-black shadow-md border border-amber-400 cursor-pointer'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer'
              }`}
              title={!isQualyCompleted ? tr.finalizeQualyFirst : tr.manageRaceResults}
            >
              <Flag className="h-4 w-4" />
              {tr.raceSession} {!isQualyCompleted ? '🔒' : tr.phase2}
            </button>
          </div>
        )}

        {/* Main Tab Selector */}
        <div className="flex items-center justify-between border-b border-white/10 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="h-4 w-4" />{' '}
              {tr.uploadTab.replace(
                '{session}',
                (sessionType === 'qualifying' ? tr.sessionQualifying : tr.sessionRace).toUpperCase()
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              disabled={parsedRows.length === 0}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer disabled:opacity-40 ${
                activeTab === 'preview'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-4 w-4" /> {tr.previewTab.replace('{count}', String(parsedRows.length))}
            </button>
          </div>

          {activeTab === 'preview' && sessionType === 'race' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearPoints}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold uppercase flex items-center gap-1 bg-rose-950/40 border border-rose-800/40 px-2.5 py-1 transition-colors cursor-pointer"
                title={tr.clearPointsTitle}
              >
                <Eraser className="h-3 w-3 text-rose-400" /> {tr.clearPoints}
              </button>
              <button
                type="button"
                onClick={handleRecalculatePoints}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold uppercase flex items-center gap-1 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 transition-colors cursor-pointer"
                title={tr.recalculateTitle}
              >
                <RefreshCw className="h-3 w-3 text-cyan-400" /> {tr.recalculate}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {activeTab === 'upload' ? (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-shell-line hover:border-cyan-400 bg-black/40 p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors text-center group">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-3 bg-cyan-950/60 border border-cyan-800/40 group-hover:scale-110 transition-transform">
                  <FileText className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white uppercase">
                    {file
                      ? file.name
                      : tr.dropzoneSelect.replace(
                          '{session}',
                          sessionType === 'qualifying' ? tr.sessionQualifying : tr.sessionRace
                        )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {tr.dropzoneHint}
                  </p>
                </div>
              </label>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-slate-300">
                  {tr.pasteJson}
                </label>
                <textarea
                  value={jsonText}
                  onChange={handleTextChange}
                  rows={6}
                  placeholder='{"Result": [{"DriverGuid": "7656119...", "position": 1, "points": 25}]}'
                  className="w-full border border-shell-line bg-black/50 p-3 text-xs font-mono text-cyan-200 outline-none rounded-lg focus:border-cyan-400"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
                <span className="text-xs font-extrabold uppercase text-slate-400 mr-2 shrink-0">{tr.category}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`px-3 py-1 text-xs font-extrabold uppercase transition-all border cursor-pointer shrink-0 ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                      : 'bg-black/40 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {tr.all} ({parsedRows.length})
                </button>
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategoryFilter === cat
                  const count = parsedRows.filter(
                    (r) => String(r.classTag || '').trim().toUpperCase() === String(cat || '').trim().toUpperCase()
                  ).length
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`px-3 py-1 text-xs font-extrabold uppercase transition-all border cursor-pointer shrink-0 ${getCategoryStyles(
                        cat,
                        isSelected
                      )}`}
                    >
                      {cat} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Grouped Category Tables */}
              {displayCategories.map((tag) => {
                const categoryRows = parsedRows.filter((r) => r.classTag === tag)
                if (categoryRows.length === 0) return null

                return (
                  <div key={tag} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <ClassBadge classTag={tag} className="text-xs font-black px-3 py-1" />
                        <span className="text-xs text-slate-400 font-mono font-bold">
                          ({categoryRows.length} {tr.competitors})
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                        <Edit3 className="h-3 w-3" /> {tr.editHint}
                      </span>
                    </div>

                    <div className="border border-shell-line bg-black/40 overflow-hidden">
                      <table className="w-full min-w-[560px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-shell-line bg-white/5 text-slate-400 uppercase font-mono text-[10px]">
                            <th className="p-2.5 text-center w-16">{tr.catPos}</th>
                            <th className="p-2.5">{tr.team}</th>
                            <th className="p-2.5 text-center w-24">{tr.overallPos}</th>
                             {sessionType === 'race' ? (
                              <th className="p-2.5 text-right w-32">{tr.roundPoints}</th>
                            ) : (
                              <th className="p-2.5 text-right w-32 text-slate-400 font-mono">{tr.gridPosOnly}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {categoryRows.map((row) => (
                            <tr key={row.id} className="hover:bg-white/5 transition-colors">
                              {/* 1. Editable Category Position */}
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={row.pos}
                                  onChange={(e) => handleUpdateRowPos(row.id, Number(e.target.value))}
                                  className="w-12 bg-black/80 border border-slate-700 text-center font-mono font-black text-amber-400 text-xs py-1 outline-none focus:border-cyan-400"
                                />
                              </td>

                              {/* 2. Team Name with Dorsal on right */}
                              <td className="p-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-white uppercase text-xs tracking-wide">
                                    {row.teamName}
                                  </span>
                                  {row.dorsal != null && (
                                    <span className="text-xs font-mono font-black text-cyan-300">
                                      #{row.dorsal}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Overall Position */}
                              <td className="p-2.5 text-center font-mono text-slate-400 text-xs">
                                P{row.overallPos}
                              </td>

                              {/* 4. Points display depending on sessionType */}
                              {sessionType === 'race' ? (
                                <td className="p-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-cyan-400 font-bold text-xs">+</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={500}
                                      value={row.points}
                                      onChange={(e) => handleUpdateRowPoints(row.id, Number(e.target.value))}
                                      className="w-16 bg-black/80 border border-slate-700 text-right font-mono font-black text-cyan-300 text-xs py-1 px-1.5 outline-none focus:border-cyan-400"
                                    />
                                    <span className="text-slate-400 text-[10px] font-mono">{tr.pts}</span>
                                  </div>
                                </td>
                              ) : (
                                <td className="p-2.5 text-right font-mono text-xs">
                                  <span className="bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 px-2 py-0.5 text-[10px] font-bold uppercase">
                                    {tr.gridPoints}
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-shell-line/50 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-shell-line bg-black/40 hover:bg-slate-800 px-4 py-2 text-xs font-bold uppercase text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            {tr.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedRows.length === 0}
            className="bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-40 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting
              ? tr.saving
              : sessionType === 'qualifying'
              ? tr.finalizeQualy
              : tr.finalizeRace}
          </button>
        </div>
      </div>
    </div>
  )
}
