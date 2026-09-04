'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  User,
  Shield,
  Edit3,
  X,
  Check,
  Globe,
  Trophy,
  Users,
  Award,
  Sparkles,
  Copy,
  Mail,
  AlertCircle
} from 'lucide-react'
import { COUNTRIES, getCountryName, getCountryFlagUrl } from '@/lib/countries'
import { ClassBadge } from '@/components/class-badge'
import { ImagePicker } from '@/components/image-picker'
import { updateProfile, respondTeamInvite } from './actions'
import { useDictionary } from '@/lib/i18n/locale-provider'

type ProfileData = {
  id: string
  displayName: string
  countryCode: string
  bio: string
  mainSim: 'ac' | 'lmu'
  avatarUrl: string | null
  steamId: string
  steamDisplayName: string
  preferredCategories: string[]
  isPublic: boolean
  bannerUrl: string | null
  accentColor: string | null
}

function hexToRgba(hexColor: string | null | undefined, alpha: number) {
  const value = String(hexColor || '').replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return `rgba(18,116,222,${alpha})`
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type RegistrationItem = {
  id: string
  leagueId: string
  status: string
  classTag?: string | null
  assignedNumber?: number | string | null
}

type LeagueItem = {
  id: string
  title: string
  slug: string
}

type TeamInvite = {
  id: string
  teamName: string
  teamLogoUrl: string | null
  invitedBy: string
  message: string | null
}

type Props = {
  profile: ProfileData
  registrations: RegistrationItem[]
  leagues: LeagueItem[]
  pendingInvites: TeamInvite[]
  qsInvite?: string
  initialEditOpen?: boolean
}

const CATEGORY_OPTIONS = ['GT3', 'HYPERCAR', 'FORMULA', 'LMP2']

export default function PerfilContent({
  profile,
  registrations,
  leagues,
  pendingInvites,
  qsInvite,
  initialEditOpen = false,
}: Props) {
  const router = useRouter()
  const t = useDictionary().perfil.content
  const [isEditOpen, setIsEditOpen] = useState(initialEditOpen)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedSteam, setCopiedSteam] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState(profile.displayName)
  const [editCountryCode, setEditCountryCode] = useState(profile.countryCode || 'ES')
  const [editBio, setEditBio] = useState(profile.bio || '')
  const [editIsPublic, setEditIsPublic] = useState(profile.isPublic !== false)
  const [editBannerUrl, setEditBannerUrl] = useState(profile.bannerUrl || '')
  const [editAccentColor, setEditAccentColor] = useState(profile.accentColor || '#1274de')
  const [editErrorMessage, setEditErrorMessage] = useState('')
  const [editSelectedCategories, setEditSelectedCategories] = useState<string[]>(
    profile.preferredCategories.map((c) => c.toUpperCase())
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCopySteamId = () => {
    if (!profile.steamId) return
    navigator.clipboard.writeText(profile.steamId)
    setCopiedSteam(true)
    setTimeout(() => setCopiedSteam(false), 2000)
  }

  const handleCategoryToggle = (category: string) => {
    setEditSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setEditErrorMessage('')

    const formData = new FormData(e.currentTarget)
    try {
      const res = await updateProfile(formData)
      if (res && !res.success) {
        setEditErrorMessage(res.error || 'No se pudo guardar el perfil.')
        return
      }
      setIsEditOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error('Failed to update profile:', err)
      setEditErrorMessage('No se pudo guardar el perfil.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 text-white">
      {/* 1. Header Banner & Driver Card */}
      <section
        className="relative overflow-hidden rounded-2xl border border-white/10 p-6 md:p-8"
        style={{
          backgroundImage: profile.bannerUrl
            ? `linear-gradient(112deg, rgba(6,10,17,0.94) 20%, ${hexToRgba(profile.accentColor, 0.35)} 58%, rgba(6,10,17,0.88) 100%), url(${profile.bannerUrl})`
            : `linear-gradient(135deg, #0d1420, #0a0f18, #070a10)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Glow Accent Effects */}
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full blur-3xl pointer-events-none" style={{ background: hexToRgba(profile.accentColor, 0.12) }} />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full blur-3xl pointer-events-none" style={{ background: hexToRgba(profile.accentColor, 0.12) }} />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  width={96}
                  height={96}
                  quality={90}
                  className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover ring-2"
                  style={{ boxShadow: `0 0 20px ${hexToRgba(profile.accentColor, 0.25)}`, ['--tw-ring-color' as any]: hexToRgba(profile.accentColor, 0.4) }}
                />
              ) : (
                <div
                  className="flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full text-2xl font-bold border"
                  style={{
                    background: hexToRgba(profile.accentColor, 0.1),
                    borderColor: hexToRgba(profile.accentColor, 0.3),
                    color: profile.accentColor || '#1274de',
                    boxShadow: `0 0 20px ${hexToRgba(profile.accentColor, 0.2)}`,
                  }}
                >
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Driver Identity */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="relative h-6 w-8 shrink-0 overflow-hidden rounded-sm shadow-sm" title={getCountryName(profile.countryCode)}>
                  {getCountryFlagUrl(profile.countryCode) && (
                    <Image src={getCountryFlagUrl(profile.countryCode)!} alt={getCountryName(profile.countryCode)} fill className="object-cover" />
                  )}
                </span>
                <h1 className="font-display-league text-3xl leading-none text-white md:text-4xl">
                  {profile.displayName}
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ borderColor: hexToRgba(profile.accentColor, 0.3), background: hexToRgba(profile.accentColor, 0.1), color: profile.accentColor || '#1274de' }}
                >
                  {t.officialDriver}
                </span>
              </div>

              {/* Badges Info Bar */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
                <button
                  type="button"
                  onClick={handleCopySteamId}
                  className="flex items-center gap-1.5 rounded-lg border border-shell-line bg-black/40 hover:bg-black/60 px-2.5 py-1 text-slate-300 transition-colors cursor-pointer"
                  title={t.copySteamIdTitle}
                >
                  <Copy className="h-3 w-3 text-accent" />
                  <span>{t.steamId} {profile.steamId}</span>
                  {copiedSteam && <span className="text-emerald-400 font-bold text-[10px] ml-1">{t.copied}</span>}
                </button>

                <span className="flex items-center gap-1.5 rounded-lg border border-shell-line bg-white/5 px-2.5 py-1 text-slate-200">
                  {getCountryFlagUrl(profile.countryCode) && (
                    <span className="relative h-3.5 w-5 shrink-0 overflow-hidden rounded-sm">
                      <Image src={getCountryFlagUrl(profile.countryCode)!} alt="" fill className="object-cover" />
                    </span>
                  )}
                  <span>{getCountryName(profile.countryCode)} ({profile.countryCode})</span>
                </span>
              </div>

              {/* Driver Bio Section (preserves Enters/newlines cleanly with whitespace-pre-wrap) */}
              {profile.bio && (
                <div
                  className="mt-3 rounded-lg bg-black/40 border-l-2 p-3 text-xs text-slate-300 italic max-w-2xl font-medium leading-relaxed whitespace-pre-wrap break-words"
                  style={{ borderColor: profile.accentColor || '#1274de' }}
                >
                  "{profile.bio}"
                </div>
              )}
            </div>
          </div>

          {/* Edit Profile Button (Opens Interactive Modal) */}
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="self-start md:self-center rounded-lg bg-[#1274de] hover:bg-[#1f82ee] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors shadow-[0_0_15px_rgba(18,116,222,0.3)] flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Edit3 className="h-4 w-4" />
            {t.editProfile}
          </button>
        </div>
      </section>

      {/* Invites Status Alerts */}
      {qsInvite === 'accepted' && (
        <div className="border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-300 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400" /> {t.inviteAccepted}
        </div>
      )}
      {qsInvite === 'rejected' && (
        <div className="border border-amber-500/40 bg-amber-950/40 p-3 text-xs font-bold text-amber-300 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400" /> {t.inviteDeclined}
        </div>
      )}

      {/* 2. Grid Columns: General Data & Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Data Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-shell-line pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
              <User className="h-4 w-4 text-accent" /> {t.generalDataTitle}
            </h2>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-shell-line bg-black/30 p-3 space-y-1">
              <dt className="text-[10px] text-slate-400 font-mono uppercase font-bold">{t.steamName}</dt>
              <dd className="font-bold text-white text-sm truncate">{profile.steamDisplayName}</dd>
            </div>

            <div className="rounded-lg border border-shell-line bg-black/30 p-3 space-y-1">
              <dt className="text-[10px] text-slate-400 font-mono uppercase font-bold">{t.steam64Id}</dt>
              <dd className="font-mono text-slate-300 font-semibold truncate">{profile.steamId}</dd>
            </div>

          </dl>
        </div>

        {/* My Registrations Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-shell-line pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" /> {t.myRegistrationsTitle}
            </h2>
            <Link href="/ligas" className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline">
              {t.findLeague}
            </Link>
          </div>

          <div className="space-y-3">
            {registrations.length === 0 ? (
              <div className="rounded-lg border border-shell-line bg-black/20 p-6 text-center text-slate-400 text-xs italic">
                {t.noRegistrations}
              </div>
            ) : (
              registrations.map((reg) => {
                const league = leagues.find((l) => l.id === reg.leagueId)
                return (
                  <div
                    key={reg.id}
                    className="border border-shell-line bg-black/40 p-3.5 rounded-lg flex items-center justify-between gap-3 hover:border-accent/40 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <Link
                        href={league ? `/ligas/${league.slug}` : '#'}
                        className="font-bold text-white hover:text-accent transition-colors text-xs uppercase tracking-wide truncate block"
                      >
                        {league?.title ?? t.leagueChampionshipFallback}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        {reg.classTag && <ClassBadge classTag={reg.classTag} className="text-[10px] px-2 py-0.5" />}
                        {reg.assignedNumber && (
                          <span className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 font-bold text-accent">
                            #{reg.assignedNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                      {reg.status || t.statusActive}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Team Invitations Card */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-shell-line pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> {t.pendingInvitesTitle}
          </h2>
        </div>

        <div className="space-y-3">
          {pendingInvites.length === 0 ? (
            <p className="rounded-lg border border-shell-line bg-black/20 p-4 text-center text-xs text-slate-400 italic">
              {t.noPendingInvites}
            </p>
          ) : (
            pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="border border-accent/30 bg-gradient-to-r from-black/60 via-accent/10 to-black/60 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  {invite.teamLogoUrl ? (
                    <Image
                      src={invite.teamLogoUrl}
                      alt={invite.teamName}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg object-contain border border-shell-line bg-black p-1 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-bold text-base shrink-0">
                      {invite.teamName.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="font-bold text-white uppercase text-sm tracking-wide">{invite.teamName}</h4>
                    <p className="text-xs text-slate-400">
                      {t.invitedBy} <span className="text-slate-200 font-bold">{invite.invitedBy}</span>
                    </p>
                    {invite.message && (
                      <p className="mt-1 rounded bg-black/40 px-2.5 py-1 text-xs text-slate-300 italic border-l-2 border-accent">
                        "{invite.message}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <form action={respondTeamInvite}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <button
                      type="submit"
                      className="rounded-lg border border-emerald-500/60 bg-emerald-950/80 hover:bg-emerald-600 text-emerald-200 hover:text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {t.accept}
                    </button>
                  </form>
                  <form action={respondTeamInvite}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-500/60 bg-rose-950/80 hover:bg-rose-600 text-rose-200 hover:text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {t.decline}
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Preferred Categories Card */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-shell-line pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
            <Award className="h-4 w-4 text-accent" /> {t.preferredCategoriesTitle}
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {profile.preferredCategories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t.noPreferredCategories}</p>
          ) : (
            profile.preferredCategories.map((category) => (
              <ClassBadge key={category} classTag={category} className="px-4 py-2 text-xs font-bold tracking-wider" />
            ))
          )}
        </div>
      </div>

      {/* 5. Interactive Edit Profile Modal */}
      {isEditOpen && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 flex justify-center items-start md:items-center">
              <div className="w-full max-w-2xl rounded-lg bg-[#090d16] border border-shell-line shadow-2xl my-auto relative overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-shell-line p-5">
                  <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-accent" /> {t.editDriverProfile}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
                  {editErrorMessage && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                      {editErrorMessage}
                    </div>
                  )}

                  {/* Display Name */}
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      {t.displayNameRequired}
                    </label>
                    <input
                      name="displayName"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      required
                      className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent font-bold transition-colors"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      {t.countryRequired}
                    </label>
                    <select
                      name="countryCode"
                      value={editCountryCode}
                      onChange={(e) => setEditCountryCode(e.target.value)}
                      required
                      className="w-full border border-shell-line bg-black px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent transition-colors cursor-pointer"
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code} className="bg-neutral-900 text-white">
                          {country.name} ({country.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bio with line breaks note */}
                  <div>
                    <label className="mb-1 block text-xs text-slate-300 uppercase tracking-wider font-semibold flex items-center justify-between">
                      <span>{t.driverBioMotto}</span>
                      <span className="text-[10px] text-slate-400 font-mono italic">{t.lineBreaksPreserved}</span>
                    </label>
                    <textarea
                      name="bio"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      rows={4}
                      placeholder={t.bioPlaceholder}
                      className="w-full border border-shell-line bg-black/60 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-accent transition-colors resize-y font-medium leading-relaxed"
                    />
                  </div>

                  {/* Profile Banner */}
                  <ImagePicker
                    name="bannerUrl"
                    label={t.profileBanner}
                    defaultValue={editBannerUrl}
                    onChange={setEditBannerUrl}
                    entityName={editDisplayName}
                  />

                  {/* Accent Color — any RGB color, lights up the profile banner, avatar ring and badges */}
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      {t.profileAccentColor}
                    </label>
                    <div
                      className="flex items-center gap-3 rounded-lg border border-shell-line bg-black/30 p-2.5 transition-shadow"
                      style={{ boxShadow: `0 0 18px ${editAccentColor}40` }}
                    >
                      <input
                        type="color"
                        name="accentColor"
                        value={editAccentColor}
                        onChange={(e) => setEditAccentColor(e.target.value)}
                        className="h-9 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                      />
                      <span className="font-mono-data text-xs uppercase text-slate-300">{editAccentColor}</span>
                    </div>
                  </div>

                  {/* Preferred Categories */}
                  <div className="rounded-lg border border-shell-line bg-black/30 p-4 space-y-3">
                    <p className="text-xs font-bold text-white uppercase tracking-wider">{t.preferredCompetitionCategories}</p>
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                      {CATEGORY_OPTIONS.map((category) => {
                        const isSelected = editSelectedCategories.includes(category)
                        return (
                          <label
                            key={category}
                            className={`flex items-center justify-between p-2.5 border cursor-pointer select-none transition-all rounded-lg ${
                              isSelected
                                ? 'border-accent bg-accent/10 text-accent font-bold'
                                : 'border-shell-line bg-black/40 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <ClassBadge classTag={category} className="text-[10px] px-2 py-0.5" />
                            <input
                              type="checkbox"
                              name="preferredCategories"
                              value={category}
                              checked={isSelected}
                              onChange={() => handleCategoryToggle(category)}
                              className="hidden"
                            />
                            <span
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                                isSelected ? 'border-accent bg-accent text-black font-bold' : 'border-slate-500 bg-transparent'
                              }`}
                            >
                              {isSelected && '✓'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Profile visibility */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-shell-line bg-black/30 p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">{t.profileVisibility}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {editIsPublic ? t.profileVisibilityPublicHint : t.profileVisibilityPrivateHint}
                      </p>
                      <Link href={`/perfil/${profile.id}`} target="_blank" className="mt-1.5 inline-block text-[10px] font-bold uppercase tracking-wider text-accent hover:underline">
                        {t.viewPublicProfile}
                      </Link>
                    </div>
                    <input type="hidden" name="isPublic" value={editIsPublic ? 'true' : 'false'} />
                    <button
                      type="button"
                      onClick={() => setEditIsPublic((prev) => !prev)}
                      role="switch"
                      aria-checked={editIsPublic}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                        editIsPublic ? 'bg-accent' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          editIsPublic ? 'translate-x-[20px]' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-shell-line">
                    <button
                      type="button"
                      onClick={() => setIsEditOpen(false)}
                      className="border border-shell-line bg-transparent hover:bg-white/5 px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#1274de] hover:bg-[#1f82ee] disabled:bg-accent/40 px-6 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(18,116,222,0.4)]"
                    >
                      {isSubmitting ? t.savingProfile : t.saveProfile}
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
