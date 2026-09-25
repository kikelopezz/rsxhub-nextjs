'use client'

import { useEffect, useRef, useState } from 'react'
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
  /** Se llama tras guardar una categoría sin cerrar el modal (para refrescar la página de fondo). */
  onSaved?: () => void
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
  onSaved,
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

  // Categoría a la que va TODO el JSON que se sube ('AUTO' = la que traiga cada coche en el archivo)
  const defaultCategory = classTags[0] || 'GT3'
  const [uploadCategory, setUploadCategory] = useState<string>(defaultCategory)
  // Máximo de coches que se guardan por categoría (se recuerda entre subidas)
  const [maxCars, setMaxCars] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('rsx_finish_round_max_cars'))
      return Number.isInteger(saved) && saved >= 1 && saved <= 100 ? saved : 20
    } catch {
      return 20
    }
  })
  const [infoMsg, setInfoMsg] = useState('')
  const [truncatedNotes, setTruncatedNotes] = useState<string[]>([])
  const [savedUploads, setSavedUploads] = useState<{ label: string; count: number }[]>([])

  const changeMaxCars = (value: number) => {
    const next = Math.max(1, Math.min(100, Math.floor(value) || 1))
    setMaxCars(next)
    try {
      window.localStorage.setItem('rsx_finish_round_max_cars', String(next))
    } catch {}
  }

  // Handle JSON file selection or text input parsing
  const handleParseJson = (rawContent: string, opts?: { stay?: boolean }) => {
    try {
      setErrorMsg('')
      setInfoMsg('')
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

        // Categoría: la que ha elegido el gestor para todo el archivo o, en modo automático, la que traiga el coche
        let classTag = uploadCategory
        if (uploadCategory === 'AUTO') {
          const fromJson = String(item.classTag || item.ClassTag || item.CarModel || item.carModel || '')
            .trim()
            .toUpperCase()
          classTag = classTags.find((c) => c.toUpperCase() === fromJson) || defaultCategory
        }

        // Posición dentro de la categoría: orden de llegada en el archivo
        classCounters[classTag] = (classCounters[classTag] || 0) + 1
        const catPos = classCounters[classTag]

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

      // Solo los primeros `maxCars` de cada categoría
      const totals: Record<string, number> = {}
      rows.forEach((r) => {
        totals[r.classTag] = (totals[r.classTag] || 0) + 1
      })
      const limited = rows.filter((r) => r.pos <= maxCars)
      setTruncatedNotes(
        Object.entries(totals)
          .filter(([, total]) => total > maxCars)
          .map(([cat, total]) =>
            tr.carsTruncated.replace('{cat}', cat).replace('{total}', String(total)).replace('{max}', String(maxCars))
          )
      )

      setParsedRows(limited)
      if (!opts?.stay) setActiveTab('preview')
    } catch (err: any) {
      setErrorMsg(err.message || tr.parseError)
    }
  }

  // Al cambiar la categoría o el máximo, el archivo ya cargado se vuelve a repartir con los nuevos valores
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (jsonText.trim() && parsedRows.length > 0) handleParseJson(jsonText, { stay: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadCategory, maxCars])

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
        headers: { 'x-requested-with': 'fetch' },
        body: formData,
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.ok) {
        const tags = Array.from(new Set(parsedRows.map((r) => r.classTag)))
        setSavedUploads((prev) => [...prev, { label: tags.join(' + '), count: Number(data.imported) || parsedRows.length }])
        const warnings: string[] = []
        if (data.notRegistered > 0) warnings.push(tr.notRegisteredWarn.replace('{n}', String(data.notRegistered)))
        if (data.unresolved > 0) warnings.push(tr.unresolvedWarn.replace('{n}', String(data.unresolved)))
        setInfoMsg([tr.uploadNext, ...warnings].join(' '))
        // Listo para subir el JSON de otra categoría
        setParsedRows([])
        setJsonText('')
        setFile(null)
        setTruncatedNotes([])
        setSelectedCategoryFilter('ALL')
        setActiveTab('upload')
        onSaved?.()
      } else {
        setErrorMsg(data.code ? tr.saveErrorCode.replace('{code}', String(data.code)) : data.message || tr.saveError)
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:items-center md:p-6">
      <div className="relative my-auto flex w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[#0a0f18] p-5 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)] md:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono-data rounded border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4ea1ff]">
              {tr.roundManagement}
            </span>
          </div>
          <h2 className="font-display-league mt-1.5 text-2xl uppercase text-white">
            {tr.finalizeRound.replace('{round}', event.title || event.circuitName)}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{tr.uploadHint}</p>
        </div>

        {/* Session Type Selector */}
        {hasQualy && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/40 p-1.5">
            <button
              type="button"
              onClick={() => {
                setSessionType('qualifying')
                setParsedRows((prev) => prev.map((r) => ({ ...r, points: 0 })))
              }}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                sessionType === 'qualifying'
                  ? 'border border-[#4ea1ff] bg-[#1274de] text-white shadow-md'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                !isQualyCompleted
                  ? 'cursor-not-allowed border border-white/5 bg-black/40 text-slate-600'
                  : sessionType === 'race'
                  ? 'cursor-pointer border border-amber-400 bg-amber-500 text-black shadow-md'
                  : 'cursor-pointer text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
              title={!isQualyCompleted ? tr.finalizeQualyFirst : tr.manageRaceResults}
            >
              <Flag className="h-4 w-4" />
              {tr.raceSession} {!isQualyCompleted ? '🔒' : tr.phase2}
            </button>
          </div>
        )}

        {/* Main Tab Selector */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'upload'
                  ? 'border-[#4ea1ff] bg-[rgba(78,161,255,.1)] text-[#4ea1ff]'
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
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 ${
                activeTab === 'preview'
                  ? 'border-[#4ea1ff] bg-[rgba(78,161,255,.1)] text-[#4ea1ff]'
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
                className="flex items-center gap-1 rounded-md border border-rose-800/40 bg-rose-950/40 px-2.5 py-1 text-[11px] font-bold uppercase text-rose-400 transition-colors hover:text-rose-300"
                title={tr.clearPointsTitle}
              >
                <Eraser className="h-3 w-3" /> {tr.clearPoints}
              </button>
              <button
                type="button"
                onClick={handleRecalculatePoints}
                className="flex items-center gap-1 rounded-md border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.1)] px-2.5 py-1 text-[11px] font-bold uppercase text-[#4ea1ff] transition-colors hover:text-white"
                title={tr.recalculateTitle}
              >
                <RefreshCw className="h-3 w-3" /> {tr.recalculate}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {savedUploads.length > 0 && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
            <p className="mb-1 flex items-center gap-2 font-extrabold uppercase text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {tr.savedUploads}
            </p>
            <ul className="space-y-0.5 pl-6">
              {savedUploads.map((u, i) => (
                <li key={i} className="font-mono-data">
                  {tr.savedItem.replace('{cat}', u.label).replace('{n}', String(u.count))}
                </li>
              ))}
            </ul>
            {infoMsg && <p className="mt-2 text-emerald-100">{infoMsg}</p>}
          </div>
        )}

        {/* Modal Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {activeTab === 'upload' ? (
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-slate-300">{tr.jsonCategory}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {classTags.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setUploadCategory(cat)}
                        className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-extrabold uppercase transition-all ${getCategoryStyles(cat, uploadCategory === cat)}`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setUploadCategory('AUTO')}
                      className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-extrabold uppercase transition-all ${
                        uploadCategory === 'AUTO'
                          ? 'border-[#4ea1ff] bg-[#1274de] text-white shadow-[0_0_12px_rgba(78,161,255,0.45)]'
                          : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tr.autoCategory}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {uploadCategory === 'AUTO'
                      ? tr.autoCategoryHint.replace('{cat}', defaultCategory)
                      : tr.jsonCategoryHint}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-slate-300">{tr.maxCars}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxCars}
                      onChange={(e) => changeMaxCars(Number(e.target.value))}
                      className="font-mono-data w-20 rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-center text-sm font-black text-amber-400 outline-none focus:border-[#4ea1ff]"
                    />
                    {[20, 25, 30, 40].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => changeMaxCars(n)}
                        className={`font-mono-data rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                          maxCars === n
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                            : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">{tr.maxCarsHint.replace('{max}', String(maxCars))}</p>
                </div>
              </div>

              <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 bg-black/30 p-6 text-center transition-colors hover:border-[#4ea1ff]">
                <input
                  key={savedUploads.length}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="rounded-lg border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.12)] p-3 transition-transform group-hover:scale-110">
                  <FileText className="h-6 w-6 text-[#4ea1ff]" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase text-white">
                    {file
                      ? file.name
                      : tr.dropzoneSelect.replace(
                          '{session}',
                          sessionType === 'qualifying' ? tr.sessionQualifying : tr.sessionRace
                        )}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{tr.dropzoneHint}</p>
                </div>
              </label>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-slate-300">{tr.pasteJson}</label>
                <textarea
                  value={jsonText}
                  onChange={handleTextChange}
                  rows={6}
                  placeholder='{"Result": [{"DriverGuid": "7656119...", "position": 1, "points": 25}]}'
                  className="font-mono-data w-full rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-[#4ea1ff] outline-none focus:border-[#4ea1ff]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {truncatedNotes.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
                  {truncatedNotes.map((note) => (
                    <p key={note} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" /> {note}
                    </p>
                  ))}
                </div>
              )}

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 pb-2">
                <span className="mr-2 shrink-0 text-xs font-extrabold uppercase text-slate-400">{tr.category}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-extrabold uppercase transition-all ${
                    selectedCategoryFilter === 'ALL'
                      ? 'border-[#4ea1ff] bg-[#1274de] text-white shadow-[0_0_12px_rgba(78,161,255,0.45)]'
                      : 'border-white/10 bg-black/30 text-slate-400 hover:text-white'
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
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-extrabold uppercase transition-all ${getCategoryStyles(cat, isSelected)}`}
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
                    <div className="flex items-center justify-between border-b border-[#4ea1ff]/30 pb-2">
                      <div className="flex items-center gap-2">
                        <ClassBadge classTag={tag} className="px-3 py-1 text-xs font-black" />
                        <span className="font-mono-data text-xs font-bold text-slate-400">
                          ({categoryRows.length} {tr.competitors})
                        </span>
                      </div>
                      <span className="font-mono-data flex items-center gap-1 text-[10px] text-[#4ea1ff]">
                        <Edit3 className="h-3 w-3" /> {tr.editHint}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="font-mono-data border-b border-white/10 bg-white/5 text-[10px] uppercase text-slate-400">
                            <th className="w-16 p-2.5 text-center">{tr.catPos}</th>
                            <th className="p-2.5">{tr.team}</th>
                            <th className="w-24 p-2.5 text-center">{tr.overallPos}</th>
                            {sessionType === 'race' ? (
                              <th className="w-32 p-2.5 text-right">{tr.roundPoints}</th>
                            ) : (
                              <th className="font-mono-data w-32 p-2.5 text-right text-slate-400">{tr.gridPosOnly}</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {categoryRows.map((row) => (
                            <tr key={row.id} className="transition-colors hover:bg-white/5">
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={row.pos}
                                  onChange={(e) => handleUpdateRowPos(row.id, Number(e.target.value))}
                                  className="font-mono-data w-12 rounded border border-white/10 bg-black/50 py-1 text-center text-xs font-black text-amber-400 outline-none focus:border-[#4ea1ff]"
                                />
                              </td>

                              <td className="p-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-extrabold uppercase tracking-wide text-white">
                                    {row.teamName}
                                  </span>
                                  {row.dorsal != null && (
                                    <span className="font-mono-data shrink-0 rounded-md border border-[#4ea1ff]/30 bg-[rgba(78,161,255,.12)] px-2.5 py-1 text-sm font-black text-[#4ea1ff]">#{row.dorsal}</span>
                                  )}
                                </div>
                              </td>

                              <td className="font-mono-data p-2.5 text-center text-xs text-slate-400">
                                P{row.overallPos}
                              </td>

                              {sessionType === 'race' ? (
                                <td className="p-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs font-bold text-[#4ea1ff]">+</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={500}
                                      value={row.points}
                                      onChange={(e) => handleUpdateRowPoints(row.id, Number(e.target.value))}
                                      className="font-mono-data w-16 rounded border border-white/10 bg-black/50 px-1.5 py-1 text-right text-xs font-black text-[#4ea1ff] outline-none focus:border-[#4ea1ff]"
                                    />
                                    <span className="font-mono-data text-[10px] text-slate-400">{tr.pts}</span>
                                  </div>
                                </td>
                              ) : (
                                <td className="font-mono-data p-2.5 text-right text-xs">
                                  <span className="rounded-full border border-[#4ea1ff]/40 bg-[rgba(78,161,255,.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4ea1ff]">
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
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={savedUploads.length > 0 ? onSuccess : onClose}
            className="rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold uppercase text-slate-300 transition-colors hover:bg-white/5"
          >
            {savedUploads.length > 0 ? tr.finish : tr.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || parsedRows.length === 0}
            className="flex items-center gap-2 rounded-lg border border-[#4ea1ff] bg-[#1274de] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(78,161,255,0.4)] transition-all hover:bg-[#1f82ee] disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting
              ? tr.saving
              : tr.saveUpload
                  .replace('{cat}', Array.from(new Set(parsedRows.map((r) => r.classTag))).join(' + ') || uploadCategory)
                  .replace('{n}', String(parsedRows.length))}
          </button>
        </div>
      </div>
    </div>
  )
}
