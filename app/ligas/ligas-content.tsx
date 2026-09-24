'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, X, Trophy } from 'lucide-react'
import { LeagueCard } from '@/components/league-card'
import { createLeagueAction, deleteLeagueAction } from './actions'
import { ImagePicker } from '@/components/image-picker'
import { useDictionary } from '@/lib/i18n/locale-provider'

type League = {
  id: string
  title: string
  slug: string
  simulator: string
  format: string
  classTags?: string[]
  startsAt: string
  endsAt: string
  registrationOpen: boolean
  status: string
  bannerUrl: string | null
  accentColor?: string | null
  shortDescription?: string
  leader?: { name: string; logoUrl: string | null; points: number } | null
}

type Props = {
  simulators: Array<{ key: string; name: string; logoUrl: string | null }>
  initialLeagues: League[]
  registeredByLeague: Record<string, number>
  isAdmin: boolean
  searchParams: {
    simulator?: string
    status?: string
    format?: string
    q?: string
  }
}

export default function LigasPageContent({
  simulators,
  initialLeagues,
  registeredByLeague,
  isAdmin,
  searchParams,
}: Props) {
  const router = useRouter()
  const dict = useDictionary()
  const t = dict.ligas
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newLeagueTitle, setNewLeagueTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>(['GT3', 'LMP2', 'HYPERCAR'])
  const [formAccentColor, setFormAccentColor] = useState('#1274de')

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Filters from URL — native GET-form submit re-navigates with these as query params.
  const q = (searchParams.q || '').toLowerCase().trim()
  const filtered = initialLeagues.filter((league) => {
    const matchSimulator = !searchParams.simulator || league.simulator === searchParams.simulator
    const matchStatus =
      !searchParams.status ||
      (searchParams.status === 'registering' ? league.registrationOpen : league.status === searchParams.status)
    const matchFormat = !searchParams.format || league.format === searchParams.format
    const matchQuery =
      !q ||
      league.title.toLowerCase().includes(q) ||
      (league.shortDescription && league.shortDescription.toLowerCase().includes(q))
    return matchSimulator && matchStatus && matchFormat && matchQuery
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    const formData = new FormData(e.currentTarget)
    try {
      await createLeagueAction(formData)
      setIsCreateOpen(false)
      router.refresh()
    } catch (err: any) {
      if (err?.digest?.startsWith('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') {
        setIsCreateOpen(false)
        router.refresh()
        return
      }
      setErrorMessage(err.message || t.list.createFailed)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, slug: string, title: string) => {
    if (confirm(t.list.deleteConfirm.replace('{slug}', title))) {
      try {
        await deleteLeagueAction(id, slug)
        router.refresh()
      } catch (err: any) {
        alert(err.message || t.list.deleteFailed)
      }
    }
  }

  return (
    <div className="space-y-6 text-white">
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="font-mono-data text-[11px] font-medium tracking-[0.35em] text-[#4ea1ff]">TEMPORADA {new Date().getFullYear()}</span>
          <h1 className="font-display-league mt-1 flex items-center gap-3 text-4xl uppercase tracking-tight text-white md:text-5xl">
            <Trophy className="h-8 w-8 text-[#4ea1ff]" />
            {t.list.title}
          </h1>
          <p className="mt-2 max-w-xl text-xs text-slate-400 md:text-sm">{t.list.subtitle}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setNewLeagueTitle('')
              setIsCreateOpen(true)
            }}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#4ea1ff] bg-[#1274de] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_18px_rgba(78,161,255,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f82ee] hover:shadow-[0_0_24px_rgba(78,161,255,0.7)] md:self-auto"
          >
            <Plus className="h-4 w-4" />
            {t.list.createLeague}
          </button>
        )}
      </div>

      {/* Filters */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1420] p-4 md:p-5">
        <form className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder={t.list.searchPlaceholder}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-slate-500 focus:border-[#4ea1ff]"
          />
          <select
            name="simulator"
            defaultValue={searchParams.simulator}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
          >
            <option value="">{t.list.allSimulators}</option>
            {simulators.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          <select
            name="format"
            defaultValue={searchParams.format}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
          >
            <option value="">Todos los formatos</option>
            <option value="endurance">Endurance</option>
            <option value="sprint">Sprint</option>
            <option value="time_attack">Time Attack</option>
          </select>
          <select
            name="status"
            defaultValue={searchParams.status}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]"
          >
            <option value="">{t.list.allStatus}</option>
            <option value="registering">Inscripciones abiertas</option>
            <option value="open">{t.list.statusOpen}</option>
            <option value="ongoing">{t.list.statusOngoing}</option>
            <option value="closed">{t.list.statusClosed}</option>
            <option value="finished">{t.list.statusFinished}</option>
          </select>
          <button className="rounded-lg border border-[#4ea1ff] bg-[#1274de] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_14px_rgba(78,161,255,0.4)] transition-all hover:bg-[#1f82ee]">
            {t.list.applyFilters}
          </button>
        </form>
      </section>

      {/* Season directory grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-white/10 bg-[#0d1420] p-8 text-center md:p-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#4ea1ff]">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">{t.list.emptyTitle}</h3>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              {t.list.emptyBody} {isAdmin && t.list.emptyBodyAdminHint}
            </p>
          </div>
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((league) => (
            <div key={league.id} className="group flex h-full flex-col">
              <div className="flex-1">
                <LeagueCard league={league as any} registeredCount={registeredByLeague[league.id] || 0} />
              </div>
              {isAdmin && (
                <div className="flex justify-end rounded-b-2xl border border-t-0 border-white/10 bg-black/30 p-2">
                  <button
                    onClick={() => handleDelete(league.id, league.slug, league.title)}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-400 transition-colors hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t.list.deleteLeague}
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Create League Modal */}
      {isCreateOpen && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm md:items-center">
              <div className="relative my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f18] shadow-[0_0_60px_rgba(0,0,0,0.8)]">
                <div className="flex items-center justify-between border-b border-white/10 p-4 md:p-5">
                  <h2 className="font-display-league text-xl uppercase tracking-tight text-white">
                    {t.createModal.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-4 md:p-6">
                  {errorMessage && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                      {errorMessage}
                    </div>
                  )}

                  {/* General */}
                  <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
                      {t.createModal.section1}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.leagueName}</label>
                        <input
                          name="title"
                          type="text"
                          required
                          value={newLeagueTitle}
                          onChange={(e) => setNewLeagueTitle(e.target.value)}
                          placeholder={t.createModal.leagueNamePlaceholder}
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#4ea1ff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.slug}</label>
                        <input
                          name="slug"
                          type="text"
                          placeholder={t.createModal.slugPlaceholder}
                          className="font-mono-data w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-[#4ea1ff] outline-none focus:border-[#4ea1ff]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rules / sim / format */}
                  <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
                      {t.createModal.section2}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.simulator}</label>
                        <select name="simulator" required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]">
                          {simulators.map((s) => (
                            <option key={s.key} value={s.key}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.format}</label>
                        <select name="format" required className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]">
                          <option value="endurance">{t.createModal.formatEndurance}</option>
                          <option value="sprint">{t.createModal.formatSprint}</option>
                          <option value="time_attack">{t.createModal.formatTimeAttack}</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.leagueStatus}</label>
                        <select name="status" defaultValue="open" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]">
                          <option value="open">{t.createModal.statusOpenOption}</option>
                          <option value="ongoing">{t.createModal.statusOngoingOption}</option>
                          <option value="closed">{t.createModal.statusClosedOption}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.registrationMode}</label>
                      <select name="registrationMode" defaultValue="team" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]">
                        <option value="team">{t.createModal.registrationModeTeam}</option>
                        <option value="individual">{t.createModal.registrationModeIndividual}</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">Color de campeonato</label>
                      <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                            { name: 'Light Blue', hex: '#4ea1ff' },
                            { name: 'Racing Red', hex: '#ef4444' },
                            { name: 'Electric Blue', hex: '#1274de' },
                            { name: 'Emerald Green', hex: '#10b981' },
                            { name: 'Hyper Orange', hex: '#f59e0b' },
                            { name: 'Neon Purple', hex: '#a855f7' },
                            { name: 'Cyan', hex: '#38bdf8' },
                          ].map((color) => (
                            <button
                              key={color.hex}
                              type="button"
                              onClick={() => setFormAccentColor(color.hex)}
                              title={color.name}
                              className={`h-6 w-6 rounded-md border transition-transform ${
                                formAccentColor.toLowerCase() === color.hex.toLowerCase()
                                  ? 'z-10 scale-125 border-white shadow-[0_0_10px_rgba(78,161,255,0.7)] ring-2 ring-[#4ea1ff]'
                                  : 'border-white/20 hover:scale-110'
                              }`}
                              style={{ backgroundColor: color.hex }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-[10px] text-slate-400">Personalizado:</span>
                          <input
                            type="text"
                            name="accentColor"
                            value={formAccentColor}
                            onChange={(e) => setFormAccentColor(e.target.value)}
                            className="font-mono-data w-28 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-xs text-white outline-none focus:border-[#4ea1ff]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categories & dates */}
                  <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
                      {t.createModal.section3}
                    </h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold uppercase text-slate-300">{t.createModal.categoriesAndSlots}</label>
                        <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-white/10 bg-black/40 p-3">
                          {['GT3', 'HYPERCAR', 'LMP2'].map((cat) => {
                            const isChecked = selectedTags.includes(cat)
                            return (
                              <label
                                key={cat}
                                className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg border p-2 transition-colors ${
                                  isChecked ? 'border-[#4ea1ff]/40 bg-[rgba(78,161,255,.1)]' : 'border-white/10 bg-black/30 opacity-60'
                                }`}
                              >
                                <span className="flex items-center gap-2 text-xs font-bold text-white">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTagToggle(cat)}
                                    className="h-4 w-4 cursor-pointer accent-[#1274de]"
                                  />
                                  {cat}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        <input type="hidden" name="classTags" value={selectedTags.join(', ')} />
                      </div>
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold uppercase text-slate-300">{t.createModal.championshipDates}</label>
                        <div className="space-y-4 rounded-lg border border-white/10 bg-black/40 p-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.startDate}</label>
                            <input name="startsAt" type="date" required className="font-mono-data w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-300">{t.createModal.endDate}</label>
                            <input name="endsAt" type="date" required className="font-mono-data w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-[#4ea1ff]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Media */}
                  <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
                      {t.createModal.section4}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <ImagePicker name="bannerUrl" defaultValue="" label={t.createModal.bannerLabel} entityName={newLeagueTitle} />
                      <ImagePicker name="logoUrl" defaultValue="" label={t.createModal.logoLabel} entityName={newLeagueTitle} square />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
                    >
                      {t.createModal.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 rounded-lg border border-[#4ea1ff] bg-[#1274de] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(78,161,255,0.4)] transition-all hover:bg-[#1f82ee] disabled:opacity-50"
                    >
                      {isSubmitting ? t.createModal.creating : t.createModal.create}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
