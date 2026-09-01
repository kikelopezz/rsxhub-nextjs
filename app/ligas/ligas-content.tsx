'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, X, AlertCircle } from 'lucide-react'
import { LeagueCard } from '@/components/league-card'
import { SectionTitle } from '@/components/section-title'
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
  shortDescription?: string
}

type Props = {
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
  initialLeagues,
  registeredByLeague,
  isAdmin,
  searchParams,
}: Props) {
  const router = useRouter()
  const dict = useDictionary()
  const t = dict.ligas
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>(['GT3', 'LMP2', 'HYPERCAR'])
  const [selectedAccent, setSelectedAccent] = useState('#1274de')

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  // Filters from URL or state
  const q = (searchParams.q || '').toLowerCase().trim()
  const filtered = initialLeagues.filter((league) => {
    const matchSimulator = !searchParams.simulator || league.simulator === searchParams.simulator
    const matchStatus = !searchParams.status || league.status === searchParams.status
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

  const handleDelete = async (id: string, slug: string) => {
    if (confirm(t.list.deleteConfirm.replace('{slug}', slug))) {
      try {
        await deleteLeagueAction(id)
        router.refresh()
      } catch (err: any) {
        alert(err.message || t.list.deleteFailed)
      }
    }
  }

  return (
    <div className="space-y-6 text-white">
      {/* Main Page Title Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-shell-line pb-4">
        <SectionTitle
          title={t.list.title}
          subtitle={t.list.subtitle}
        />
        {isAdmin && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#1274de] hover:bg-[#1f82ee] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition-colors flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {t.list.createLeague}
          </button>
        )}
      </div>

      {/* Search and Filters Box */}
      <section className="shell-panel p-4 md:p-5 rounded-lg">
        <form className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder={t.list.searchPlaceholder}
            className="border border-shell-line bg-black/20 px-3 py-2 text-xs text-white outline-none rounded-lg placeholder:text-slate-500 focus:border-accent"
          />

          <select
            name="simulator"
            defaultValue={searchParams.simulator}
            className="border border-shell-line bg-black/20 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent"
          >
            <option value="">{t.list.allSimulators}</option>
            <option value="ac">Assetto Corsa</option>
          </select>

          <select
            name="status"
            defaultValue={searchParams.status}
            className="border border-shell-line bg-black/20 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent"
          >
            <option value="">{t.list.allStatus}</option>
            <option value="open">{t.list.statusOpen}</option>
            <option value="ongoing">{t.list.statusOngoing}</option>
            <option value="finished">{t.list.statusFinished}</option>
          </select>

          <button className="bg-[#1274de] hover:bg-[#1f82ee] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition-colors">
            {t.list.applyFilters}
          </button>
        </form>
      </section>

      {/* Leagues List Grid */}
      {filtered.length === 0 ? (
        <div className="shell-panel flex flex-col items-center justify-center text-center p-8 md:p-12 space-y-4 rounded-lg border border-shell-line bg-zinc-950/40">
          <div className="flex h-12 w-12 items-center justify-center bg-white/5 border border-white/10 text-slate-400">
            <AlertCircle className="h-6 w-6 text-[#1274de]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">{t.list.emptyTitle}</h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {t.list.emptyBody} {isAdmin && t.list.emptyBodyAdminHint}
            </p>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((league) => (
            <div key={league.id} className="flex flex-col h-full group">
              <div className="flex-1">
                <LeagueCard
                  league={league as any}
                  registeredCount={registeredByLeague[league.id] || 0}
                />
              </div>
              {isAdmin && (
                <div className="border border-t-0 border-shell-line bg-zinc-950 p-2 flex justify-end rounded-lg">
                  <button
                    onClick={() => handleDelete(league.id, league.title)}
                    className="border border-rose-500/40 hover:bg-rose-500/10 px-3 py-1 text-xxs font-bold uppercase tracking-wider text-rose-400 rounded-lg transition-colors flex items-center gap-1"
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

      {/* Create League Modal dialog */}
      {isCreateOpen && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 flex justify-center items-start md:items-center">
              <div className="w-full max-w-4xl rounded-lg bg-[#090d16] border border-shell-line shadow-2xl my-auto relative p-2 md:p-4 overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-shell-line p-4 md:p-5">
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    {t.createModal.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
                  {errorMessage && (
                    <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300 rounded-lg">
                      {errorMessage}
                    </div>
                  )}

                  {/* SECTION 1: General Info */}
                  <div className="space-y-4 rounded-lg bg-black/20 p-4 border border-shell-line">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent border-b border-shell-line pb-2">
                      {t.createModal.section1}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.leagueName}</label>
                        <input
                          name="title"
                          type="text"
                          required
                          placeholder={t.createModal.leagueNamePlaceholder}
                          className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent font-bold"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.slug}</label>
                        <input
                          name="slug"
                          type="text"
                          placeholder={t.createModal.slugPlaceholder}
                          className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-accent outline-none rounded-lg focus:border-accent font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Rules, Simulator & Format */}
                  <div className="space-y-4 rounded-lg bg-black/20 p-4 border border-shell-line">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent border-b border-shell-line pb-2">
                      {t.createModal.section2}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.simulator}</label>
                        <select
                          name="simulator"
                          required
                          className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent font-semibold"
                        >
                          <option value="ac">Assetto Corsa</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.format}</label>
                        <select
                          name="format"
                          required
                          className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent font-semibold"
                        >
                          <option value="endurance">{t.createModal.formatEndurance}</option>
                          <option value="sprint">{t.createModal.formatSprint}</option>
                          <option value="championship">{t.createModal.formatChampionship}</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.leagueStatus}</label>
                        <select
                          name="status"
                          defaultValue="open"
                          className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent font-semibold"
                        >
                          <option value="open">{t.createModal.statusOpenOption}</option>
                          <option value="completed">{t.createModal.statusClosedOption}</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div>
                        <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.registrationMode}</label>
                        <select
                          name="registrationMode"
                          defaultValue="team"
                          className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent"
                        >
                          <option value="team">{t.createModal.registrationModeTeam}</option>
                          <option value="individual">{t.createModal.registrationModeIndividual}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Categories, Max Slots & Dates */}
                  <div className="space-y-4 rounded-lg bg-black/20 p-4 border border-shell-line">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent border-b border-shell-line pb-2">
                      {t.createModal.section3}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Category Selection & Max Slots */}
                      <div className="space-y-3">
                        <label className="block text-xs text-slate-300 uppercase font-semibold">{t.createModal.categoriesAndSlots}</label>
                        <div className="grid grid-cols-1 gap-2.5 rounded-lg bg-black/60 p-3 border border-shell-line">
                          {['GT3', 'HYPERCAR', 'LMP2'].map((cat) => {
                            const isChecked = selectedTags.includes(cat)
                            return (
                              <div
                                key={cat}
                                className={`rounded-lg p-2 border transition-colors flex items-center justify-between gap-3 ${
                                  isChecked
                                    ? 'bg-accent/10 border-accent/40'
                                    : 'bg-black/40 border-shell-line opacity-60'
                                }`}
                              >
                                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTagToggle(cat)}
                                    className="h-4 w-4 accent-[#1274de] cursor-pointer"
                                  />
                                  <span>{cat}</span>
                                </label>
                              </div>
                            )
                          })}
                        </div>
                        <input type="hidden" name="classTags" value={selectedTags.join(', ')} />
                      </div>

                      {/* Championship Dates */}
                      <div className="space-y-3">
                        <label className="block text-xs text-slate-300 uppercase font-semibold">{t.createModal.championshipDates}</label>
                        <div className="rounded-lg bg-black/60 p-3 border border-shell-line space-y-4">
                          <div>
                            <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.startDate}</label>
                            <input
                              name="startsAt"
                              type="date"
                              required
                              className="w-full border border-shell-line bg-black/80 px-3 py-2 text-xs text-white font-mono outline-none rounded-lg focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.createModal.endDate}</label>
                            <input
                              name="endsAt"
                              type="date"
                              required
                              className="w-full border border-shell-line bg-black/80 px-3 py-2 text-xs text-white font-mono outline-none rounded-lg focus:border-accent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: Media & Banner Images */}
                  <div className="space-y-4 rounded-lg bg-black/20 p-4 border border-shell-line">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent border-b border-shell-line pb-2">
                      {t.createModal.section4}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <ImagePicker
                          name="bannerUrl"
                          defaultValue=""
                          label={t.createModal.bannerLabel}
                        />
                      </div>
                      <div>
                        <ImagePicker
                          name="logoUrl"
                          defaultValue=""
                          label={t.createModal.logoLabel}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-shell-line/50">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="border border-shell-line bg-transparent hover:bg-white/5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      {t.createModal.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#1274de] hover:bg-[#1f82ee] disabled:bg-accent/40 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(18,116,222,0.4)]"
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
