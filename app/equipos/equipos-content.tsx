'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { TeamShowcase } from '@/components/team-showcase'
import { ImagePicker } from '@/components/image-picker'
import { Plus, X, Shield, Users, Trophy } from 'lucide-react'
import { useDictionary } from '@/lib/i18n/locale-provider'

type TeamDashboard = {
  id: string
  name: string
  description: string | null
  classTags: string[]
  logoUrl: string | null
  bannerUrl?: string | null
  carSkinUrls: string[]
  skinAssignments: any[]
  ownerUserId: string | null
  createdAt: string
  members: any[]
  invites: any[]
  occupiedSlots: number
  competitionClassTags?: string[]
  primaryColor?: string | null
  accentColor?: string | null
  slogan?: string | null
  discordUrl?: string | null
  youtubeUrl?: string | null
}

type LeagueOption = {
  slug: string
  title: string
}

type EquiposContentProps = {
  teams: TeamDashboard[]
  leagues: LeagueOption[]
  createTeamAction: (formData: FormData) => Promise<void>
  session: any
  hasOwnedTeam: boolean
  belongsToTeam?: boolean
}

export default function EquiposContent({
  teams,
  leagues,
  createTeamAction,
  session,
  hasOwnedTeam,
  belongsToTeam = false
}: EquiposContentProps) {
  const router = useRouter()
  const dict = useDictionary()
  const tr = dict.equipos.list
  const trModal = dict.equipos.createModal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedAccent, setSelectedAccent] = useState('#00f0ff')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    try {
      await createTeamAction(formData)
    } catch (err: any) {
      // Next.js redirect throws internally — that's expected
      if (!err?.digest?.startsWith('NEXT_REDIRECT') && err?.message !== 'NEXT_REDIRECT') {
        console.error('Failed to create team:', err)
      }
    } finally {
      setIsSubmitting(false)
      setIsCreateOpen(false)
      router.refresh()
    }
  }

  const totalDrivers = teams.reduce((sum, team) => sum + (team.members?.length || 0), 0)
  const totalCategories = new Set(teams.flatMap((team) => team.classTags || [])).size

  return (
    <div className="space-y-6 text-white">
      {/* Header: identity + CTA, with stats as distinct pill-cards below */}
      <div className="relative overflow-hidden border border-shell-line bg-gradient-to-br from-[#0d1420] via-[#0a0f18] to-[#070a10] rounded-lg p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-shell-accent">
              <Shield className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{tr.title}</h1>
              <p className="mt-1 text-sm text-slate-400 max-w-xl">{tr.subtitle}</p>
            </div>
          </div>

          {session && (
            belongsToTeam ? (
              <button
                disabled
                title={tr.alreadyInTeamTitle}
                className="shrink-0 flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-400 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg cursor-not-allowed"
              >
                {tr.alreadyInTeam}
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedTags([])
                  setIsCreateOpen(true)
                }}
                className="shrink-0 flex items-center gap-2 bg-[#1274de] hover:bg-[#1f82ee] px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {tr.createTeam}
              </button>
            )
          )}
        </div>

        {/* Stat pill-cards */}
        {teams.length > 0 && (
          <div className="relative mt-6 grid grid-cols-3 gap-3">
            {[
              { icon: Shield, value: teams.length, label: 'Equipos' },
              { icon: Users, value: totalDrivers, label: 'Pilotos' },
              { icon: Trophy, value: totalCategories, label: 'Categorías' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-3.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                  <stat.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-lg font-bold text-white leading-none">{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Teams (3 per row on lg) */}
      <section className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-shell-line bg-transparent py-16 px-8 lg:col-span-3 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center border border-shell-line bg-white/5 text-slate-500">
              <Shield className="h-7 w-7" />
            </div>
            <p className="text-sm text-slate-400 max-w-xs">{tr.noTeamsYet}</p>
            {session && !belongsToTeam && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 bg-[#1274de] hover:bg-[#1f82ee] px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {tr.createFirstTeam}
              </button>
            )}
          </div>
        ) : (
          teams.map((team) => {
            const pilotNames = team.members.map(
              (m) => m.displayName || m.steamDisplayName || tr.driverFallback
            )
            return (
              <TeamShowcase
                key={team.id}
                teamName={team.name}
                teamLogoUrl={team.logoUrl}
                teamBannerUrl={team.bannerUrl}
                primaryColor={team.primaryColor}
                accentColor={team.accentColor}
                slogan={team.slogan}
                competitionClasses={team.classTags && team.classTags.length > 0 ? team.classTags : ['UNCLASSIFIED']}
                pilotNames={pilotNames}
                profileHref={`/equipos/${team.id}`}
                skins={team.skinAssignments}
              />
            )
          })
        )}
      </section>

      {/* Create Team Modal */}
      {isCreateOpen && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 flex justify-center items-start md:items-center">
              <div className="w-full max-w-2xl rounded-lg bg-[#090d16] border border-shell-line shadow-2xl my-auto relative overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-shell-line p-5">
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    {trModal.title}
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
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Team Name */}
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      {trModal.teamName}
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder={trModal.teamNamePlaceholder}
                      className="w-full border border-shell-line bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-accent rounded-lg transition-colors"
                    />
                  </div>

                  {/* Team Description */}
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      {trModal.shortDescription}
                    </label>
                    <textarea
                      name="description"
                      rows={2}
                      placeholder={trModal.shortDescriptionPlaceholder}
                      className="w-full border border-shell-line bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-accent rounded-lg transition-colors resize-none"
                    />
                  </div>

                  {/* Team Logo & Banner Pickers */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <ImagePicker
                      name="logoUrl"
                      label={trModal.teamLogo}
                      defaultValue=""
                    />
                    <ImagePicker
                      name="bannerUrl"
                      label={trModal.teamBanner}
                      defaultValue=""
                    />
                  </div>

                  {/* Categories */}
                  <div>
                    <label className="mb-2 block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      {trModal.competingCategories}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { tag: 'GT3',      active: 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]' },
                        { tag: 'LMP2',     active: 'border-[#1274de] bg-[#1274de]/20 text-blue-300 shadow-[0_0_8px_rgba(18,116,222,0.3)]' },
                        { tag: 'HYPERCAR', active: 'border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_8px_rgba(220,38,38,0.3)]' },
                      ] as const).map(({ tag, active }) => {
                        const isSelected = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTagToggle(tag)}
                            className={`border px-5 py-2 text-xs font-black tracking-widest uppercase transition-all rounded-lg cursor-pointer ${
                              isSelected
                                ? active
                                : 'border-shell-line bg-white/5 hover:bg-white/10 text-slate-500'
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                    <input type="hidden" name="classTags" value={selectedTags.join(',')} />
                  </div>

                  {/* Team Identity & Customization */}
                  <div className="rounded-lg border border-shell-line bg-black/20 p-4 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent border-b border-shell-line pb-2">
                      {trModal.identitySection}
                    </h3>

                    {/* Slogan */}
                    <div>
                      <label className="mb-1 block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {trModal.slogan}
                      </label>
                      <input
                        type="text"
                        name="slogan"
                        placeholder={trModal.sloganPlaceholder}
                        maxLength={85}
                        className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-accent rounded-lg transition-colors"
                      />
                    </div>

                    {/* Accent Color Selection */}
                    <div>
                      <label className="mb-1.5 block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {trModal.accentColor}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'Neon Blue', hex: '#00f0ff', bg: 'bg-[#00f0ff]' },
                          { name: 'Neon Pink', hex: '#ff007f', bg: 'bg-[#ff007f]' },
                          { name: 'Electric Lime', hex: '#39ff14', bg: 'bg-[#39ff14]' },
                          { name: 'Fiery Orange', hex: '#ff5500', bg: 'bg-[#ff5500]' },
                          { name: 'Golden Yellow', hex: '#ffea00', bg: 'bg-[#ffea00]' },
                          { name: 'Acid Purple', hex: '#b026ff', bg: 'bg-[#b026ff]' },
                        ].map((color) => {
                          const isSelected = selectedAccent === color.hex
                          return (
                            <button
                              key={color.hex}
                              type="button"
                              onClick={() => setSelectedAccent(color.hex)}
                              className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-all rounded-lg cursor-pointer ${
                                isSelected
                                  ? 'border-accent bg-accent/10 text-white'
                                  : 'border-shell-line bg-black/40 hover:bg-white/5 text-slate-400'
                              }`}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full ${color.bg}`} />
                              {color.name}
                            </button>
                          )
                        })}
                      </div>
                      <input type="hidden" name="accentColor" value={selectedAccent} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Discord Link */}
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {trModal.discordLink}
                        </label>
                        <input
                          type="url"
                          name="discordUrl"
                          placeholder={trModal.discordPlaceholder}
                          className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-accent rounded-lg transition-colors"
                        />
                      </div>

                      {/* YouTube Channel */}
                      <div>
                        <label className="mb-1 block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {trModal.youtubeLink}
                        </label>
                        <input
                          type="url"
                          name="youtubeUrl"
                          placeholder={trModal.youtubePlaceholder}
                          className="w-full border border-shell-line bg-black/40 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-accent rounded-lg transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-shell-line/50">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="border border-shell-line bg-transparent hover:bg-white/5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      {trModal.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#1274de] hover:bg-[#1f82ee] disabled:bg-accent/40 px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? trModal.saving : trModal.create}
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
