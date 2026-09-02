'use client'

import React, { useState } from 'react'
import { useRouter, unstable_rethrow } from 'next/navigation'
import { X } from 'lucide-react'
import { ImagePicker } from '@/components/image-picker'
import { updateLeagueDetailsAction, deleteLeagueAction } from '@/app/ligas/actions'
import { useDictionary } from '@/lib/i18n/locale-provider'
type LeagueEditModalProps = {
  league: any
  isOpen: boolean
  onClose: () => void
}

export function LeagueEditModal({ league, isOpen, onClose }: LeagueEditModalProps) {
  const router = useRouter()
  const dict = useDictionary()
  const t = dict.ligas.createModal
  const tEdit = dict.ligas.editModal
  const accentHex = league.accentColor || '#1274de'

  const [formTitle, setFormTitle] = useState(league.title)
  const [formSlug, setFormSlug] = useState(league.slug)
  const [formSimulator, setFormSimulator] = useState(league.simulator || 'ac')
  const [formFormat, setFormFormat] = useState(league.format || 'sprint')
  const [formStatus, setFormStatus] = useState(league.status || 'open')
  const [formRegistrationMode, setFormRegistrationMode] = useState((league as any).registrationMode || 'team')
  const [formClassTags, setFormClassTags] = useState((league.classTags || []).join(', '))
  const [formStartsAt, setFormStartsAt] = useState(league.startsAt.split('T')[0])
  const [formEndsAt, setFormEndsAt] = useState(league.endsAt.split('T')[0])
  const [formRegistrationOpen, setFormRegistrationOpen] = useState(league.registrationOpen)
  const [formSlogan, setFormSlogan] = useState(league.slogan || '')
  const [formAccentColor, setFormAccentColor] = useState(accentHex)
  const [formBannerUrl, setFormBannerUrl] = useState(league.bannerUrl || '')
  const [formLogoUrl, setFormLogoUrl] = useState((league as any).logoUrl || '')
  const [isLeagueSubmitting, setIsLeagueSubmitting] = useState(false)

  if (!isOpen) return null

  const handleLeagueDelete = async () => {
    if (!confirm(tEdit.deleteConfirm)) return
    try {
      await deleteLeagueAction(league.id, league.slug)
      router.push('/ligas')
    } catch (e: any) {
      unstable_rethrow(e)
      alert(e.message || tEdit.deleteFailed)
    }
  }

  const handleLeagueUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLeagueSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('leagueId', league.id)
      formData.set('title', formTitle)
      formData.set('slug', formSlug)
      formData.set('simulator', formSimulator)
      formData.set('format', formFormat)
      formData.set('status', formStatus)
      formData.set('registrationMode', formRegistrationMode)
      formData.set('classTags', formClassTags)
      formData.set('startsAt', formStartsAt)
      formData.set('endsAt', formEndsAt)
      formData.set('registrationOpen', formRegistrationOpen ? 'true' : 'false')
      formData.set('slogan', formSlogan)
      formData.set('accentColor', formAccentColor)
      formData.set('bannerUrl', String(formData.get('bannerUrl') || formBannerUrl))
      formData.set('logoUrl', String(formData.get('logoUrl') || formLogoUrl))

      await updateLeagueDetailsAction(formData)
      onClose()
      router.refresh()
    } catch (err: any) {
      alert(err.message || tEdit.updateFailed)
    } finally {
      setIsLeagueSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:items-center md:p-6">
      <div className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0a0f18] p-5 text-white shadow-[0_0_60px_rgba(0,0,0,0.8)] md:p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-[#4ea1ff] hover:text-[#4ea1ff]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 border-b border-white/10 pb-3">
          <h2 className="font-display-league text-2xl uppercase text-white">
            {tEdit.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {tEdit.subtitle}
          </p>
        </div>

        <form onSubmit={handleLeagueUpdate} className="space-y-6">
          {/* SECTION 1: General Info */}
          <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
              {t.section1}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.leagueName}</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-[#4ea1ff] font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.slug}</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  required
                  className="w-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-[#4ea1ff] outline-none rounded-lg focus:border-[#4ea1ff] font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Rules, Simulator & Format */}
          <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
              {t.section2}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.simulator}</label>
                <select
                  value={formSimulator}
                  onChange={(e) => setFormSimulator(e.target.value as any)}
                  className="w-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-[#4ea1ff] font-semibold"
                >
                  <option value="ac">Assetto Corsa</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.format}</label>
                <select
                  value={formFormat}
                  onChange={(e) => setFormFormat(e.target.value as any)}
                  className="w-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-[#4ea1ff] font-semibold"
                >
                  <option value="endurance">{t.formatEndurance}</option>
                  <option value="sprint">{t.formatSprint}</option>
                  <option value="championship">{t.formatChampionship}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.leagueStatus}</label>
                <select
                  value={formStatus === 'open' ? 'open' : 'completed'}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormStatus(val as any)
                    setFormRegistrationOpen(val === 'open')
                  }}
                  className="w-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-[#4ea1ff] font-semibold"
                >
                  <option value="open">{t.statusOpenOption}</option>
                  <option value="completed">{t.statusClosedOption}</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <div>
                <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.registrationMode}</label>
                <select
                  value={formRegistrationMode}
                  onChange={(e) => setFormRegistrationMode(e.target.value as any)}
                  className="w-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-[#4ea1ff]"
                >
                  <option value="team">{t.registrationModeTeam}</option>
                  <option value="individual">{t.registrationModeIndividual}</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: Categories, Max Slots & Dates */}
          <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
              {t.section3}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Selection & Max Slots */}
              <div className="space-y-3">
                <label className="block text-xs text-slate-300 uppercase font-semibold">{t.categoriesAndSlots}</label>
                <div className="grid grid-cols-1 gap-2.5 bg-black/40 p-3 border border-white/10 rounded-lg">
                  {['GT3', 'HYPERCAR', 'LMP2'].map((cat) => {
                    const currentCats = formClassTags
                      .split(',')
                      .map((s: string) => s.trim().toUpperCase())
                      .filter(Boolean)
                    const isChecked = currentCats.includes(cat.toUpperCase())

                    return (
                      <div
                        key={cat}
                        className={`p-2 border transition-colors flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-[rgba(78,161,255,.12)] border-[#4ea1ff]/60'
                            : 'bg-black/40 border-white/10 opacity-60'
                        }`}
                      >
                        <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let updated: string[]
                              if (e.target.checked) {
                                updated = Array.from(new Set([...currentCats, cat.toUpperCase()]))
                              } else {
                                updated = currentCats.filter((c: string) => c !== cat.toUpperCase())
                              }
                              setFormClassTags(updated.join(', '))
                            }}
                            className="h-4 w-4 accent-[#1274de] cursor-pointer"
                          />
                          <span>{cat}</span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Championship Dates */}
              <div className="space-y-3">
                <label className="block text-xs text-slate-300 uppercase font-semibold">{t.championshipDates}</label>
                <div className="bg-black/40 p-3 border border-white/10 rounded-lg space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.startDate}</label>
                    <input
                      name="startsAt"
                      type="date"
                      value={formStartsAt}
                      onChange={(e) => setFormStartsAt(e.target.value)}
                      required
                      className="w-full border border-white/10 bg-black/60 px-3 py-2 text-xs text-white font-mono outline-none rounded-lg focus:border-[#4ea1ff]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase font-semibold">{t.endDate}</label>
                    <input
                      name="endsAt"
                      type="date"
                      value={formEndsAt}
                      onChange={(e) => setFormEndsAt(e.target.value)}
                      required
                      className="w-full border border-white/10 bg-black/60 px-3 py-2 text-xs text-white font-mono outline-none rounded-lg focus:border-[#4ea1ff]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Media & Banner Images */}
          <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <h3 className="border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-widest text-[#4ea1ff]">
              {t.section4}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <ImagePicker
                  name="bannerUrl"
                  defaultValue={formBannerUrl}
                  onChange={setFormBannerUrl}
                  label={t.bannerLabel}
                />
              </div>
              <div>
                <ImagePicker
                  name="logoUrl"
                  defaultValue={formLogoUrl}
                  onChange={setFormLogoUrl}
                  label={t.logoLabel}
                />
              </div>
            </div>
          </div>

          {/* DANGER ZONE & ACTIONS */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={handleLeagueDelete}
              className="flex items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-950/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-300 transition-colors hover:bg-rose-900/60"
            >
              {tEdit.deleteLeague}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/5"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isLeagueSubmitting}
                className="rounded-lg border border-[#4ea1ff] bg-[#1274de] px-6 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(78,161,255,0.4)] transition-all hover:bg-[#1f82ee] disabled:opacity-50"
              >
                {isLeagueSubmitting ? tEdit.saving : tEdit.save}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
