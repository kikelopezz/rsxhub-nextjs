import Link from 'next/link'
import Image from 'next/image'
import { CenterModal } from '@/components/center-modal'
import { ImagePicker } from '@/components/image-picker'
import { DeleteTeamButton } from '@/components/delete-team-button'
import { SubmitButton } from '@/components/submit-button'
import { FormattedDate } from '@/components/formatted-date'
import { Sparkles, Youtube, MessageSquare, Trophy, Radio, CalendarClock, Instagram, Twitter, Twitch, Music2 } from 'lucide-react'
import { updateTeam, deleteTeamAction } from '@/app/equipos/actions/team-crud'
import { isRemoteImageOptimizable } from '@/lib/image-utils'
import type { TeamStats, TeamPilot } from '../team-utils'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type TeamBannerStatsProps = {
  team: any
  canManage: boolean
  canDelete: boolean
  ownerDisplayName: string
  coOwners: string[]
  teamPilots: TeamPilot[]
  stats: TeamStats
  accentSoft: string
  accentHard: string
}

export async function TeamBannerStats({
  team,
  canManage,
  canDelete,
  ownerDisplayName,
  coOwners,
  teamPilots,
  stats,
  accentSoft,
  accentHard,
}: TeamBannerStatsProps) {
  const t = getDictionary(await getLocale()).equipos.bannerStats
  // Only ever show what this team itself set — no borrowing a league's banner just
  // because the team hasn't uploaded one of its own.
  const heroImage = (() => {
    if (team.bannerUrl || team.banner_url) return team.bannerUrl || team.banner_url
    if (team.logoUrl) return team.logoUrl
    if (Array.isArray(team.carSkinUrls)) {
      const validImg = team.carSkinUrls.find((url: string) => /\.(png|jpe?g|webp|svg)$/i.test(url))
      if (validImg) return validImg
    }
    return ''
  })()

  const accentHex = team.accentColor || team.primaryColor || '#1274de'
  const initials = String(team.name || '').slice(0, 2).toUpperCase()

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0c] shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <div
        className="relative min-h-[320px] overflow-hidden p-6 md:min-h-[380px] md:p-9"
        style={
          !heroImage
            ? { background: `linear-gradient(115deg, ${accentHex} 0%, ${accentHex} 46%, #0a0a0c 46.6%, #0a0a0c 100%)` }
            : undefined
        }
      >
        {heroImage && (
          <>
            {/* A plain CSS background-image here would always fetch straight from the
                original host on every view. Routing it through next/image instead lets
                Vercel's edge cache the optimized result (minimumCacheTTL in next.config.js),
                so only the very first request pays for a slow/uncached origin. */}
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              unoptimized={!isRemoteImageOptimizable(heroImage)}
              className="object-cover object-center"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: `linear-gradient(112deg, rgba(6,10,17,0.94) 20%, ${accentSoft} 58%, rgba(6,10,17,0.86) 100%)` }}
            />
          </>
        )}
        {!heroImage && (
          <span className="pointer-events-none absolute right-[2%] top-1/2 -translate-y-1/2 select-none font-display-league text-[230px] leading-none text-white/[0.06]">
            {initials}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${accentHard} 100%)` }} />

        {canManage && (
          <div className="absolute top-6 right-6 md:top-9 md:right-9 z-10 flex items-center gap-2">
            <CenterModal
              title={t.editGeneralInfoTitle}
              triggerLabel={t.editGeneral}
              triggerClassName="inline-flex items-center gap-1.5 border border-white/20 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white rounded-lg transition-colors cursor-pointer"
              widthClassName="w-[min(650px,94vw)]"
            >
              <form action={updateTeam} className="space-y-5 p-2 bg-[#090d16] text-white">
                <input type="hidden" name="teamId" value={team.id} />
                <input type="hidden" name="redirectTo" value={`/equipos/${team.id}`} />

                {/* Name */}
                <div>
                  <label className="mb-1 block text-xs text-slate-350 uppercase tracking-wider font-semibold text-left">
                    {t.teamName}
                  </label>
                  <input
                    name="name"
                    defaultValue={team.name}
                    placeholder={t.teamNamePlaceholder}
                    required
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-white/30 rounded-lg transition-colors text-left"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-xs text-slate-355 uppercase tracking-wider font-semibold text-left font-sans">
                    {t.shortDescription}
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={team.description || ''}
                    placeholder={t.shortDescriptionPlaceholder}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-white/30 rounded-lg transition-colors resize-none text-left"
                  />
                </div>

                {/* Slogan */}
                <div>
                  <label className="mb-1 block text-xs text-slate-355 uppercase tracking-wider font-semibold text-left font-sans">
                    {t.slogan}
                  </label>
                  <input
                    type="text"
                    name="slogan"
                    defaultValue={team.slogan || ''}
                    placeholder={t.sloganPlaceholder}
                    maxLength={85}
                    className="w-full border border-shell-line bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-white/30 rounded-lg transition-colors text-left"
                  />
                </div>

                {/* Team Logo & Banner Pickers */}
                <div className="grid gap-4 md:grid-cols-2 text-left">
                  <ImagePicker
                    name="logoUrl"
                    label={t.teamLogo}
                    defaultValue={team.logoUrl || ''}
                    entityName={team.name}
                    square
                  />
                  <ImagePicker
                    name="bannerUrl"
                    label={t.teamBanner}
                    defaultValue={team.bannerUrl || team.banner_url || ''}
                    entityName={team.name}
                  />
                </div>

                {/* Accent Color — any RGB color, not a preset list. Lights up the team's
                    cards, banner and buttons across the site. */}
                <div>
                  <label className="mb-2 block text-xs text-slate-355 uppercase tracking-wider font-semibold text-left font-sans">
                    {t.accentColor}
                  </label>
                  <div className="flex items-center gap-3 rounded-lg border border-shell-line bg-black/30 p-2.5 text-left">
                    <input
                      type="color"
                      name="accentColor"
                      defaultValue={team.accentColor || '#1274de'}
                      className="h-9 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                    />
                    <span className="font-mono-data text-xs uppercase text-slate-300">{team.accentColor || '#1274de'}</span>
                  </div>
                </div>

                {/* Social Community Links — each is independently optional, so the
                    team effectively "chooses" which networks to show by filling
                    only the ones they care about. */}
                <div>
                  <label className="mb-2 block text-xs text-slate-355 uppercase tracking-wider font-semibold text-left font-sans">
                    {t.socialLinksTitle}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { name: 'discordUrl', value: team.discordUrl, label: t.discordLink, placeholder: t.discordPlaceholder },
                      { name: 'youtubeUrl', value: team.youtubeUrl, label: t.youtubeLink, placeholder: t.youtubePlaceholder },
                      { name: 'instagramUrl', value: team.instagramUrl, label: t.instagramLink, placeholder: t.instagramPlaceholder },
                      { name: 'twitterUrl', value: team.twitterUrl, label: t.twitterLink, placeholder: t.twitterPlaceholder },
                      { name: 'twitchUrl', value: team.twitchUrl, label: t.twitchLink, placeholder: t.twitchPlaceholder },
                      { name: 'tiktokUrl', value: team.tiktokUrl, label: t.tiktokLink, placeholder: t.tiktokPlaceholder },
                    ].map((field) => (
                      <div key={field.name}>
                        <label className="mb-1 block text-xs text-slate-355 uppercase tracking-wider font-semibold text-left font-sans">
                          {field.label}
                        </label>
                        <input
                          type="url"
                          name={field.name}
                          defaultValue={field.value || ''}
                          placeholder={field.placeholder}
                          className="w-full border border-shell-line bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-white/30 rounded-lg transition-colors text-left"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="mb-2 block text-xs text-slate-300 uppercase tracking-wider font-semibold text-left font-sans">
                    {t.competitionClasses}
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {['GT3', 'LMP2', 'HYPERCAR'].map((tag) => (
                      <label key={tag} className="flex items-center gap-2 text-sm font-semibold uppercase text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          name="classTags"
                          value={tag}
                          defaultChecked={(team.classTags || []).includes(tag)}
                          className="h-4 w-4 rounded-lg border border-shell-line bg-black/20 text-shell-accent focus:ring-0 focus:ring-offset-0"
                        />
                        <span>{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-shell-line/50">
                  <SubmitButton
                    label={t.saveChanges}
                    pendingLabel={t.saving}
                    className="rounded-lg bg-shell-accent hover:bg-red-700 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
                  />
                </div>
              </form>
            </CenterModal>

            {/* Delete Team Button */}
            {canDelete && (
              <DeleteTeamButton
                teamId={team.id}
                teamName={team.name}
                deleteAction={deleteTeamAction}
              />
            )}
          </div>
        )}

        <div className="relative z-[1] max-w-4xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#b8d8ff]">{t.profileLabel}</span>
            <span className="text-[11px] text-slate-400 font-semibold font-sans flex items-center gap-2">
              <span>{t.creator} <span className="text-cyan-400 font-bold">{ownerDisplayName}</span></span>
              {coOwners.length > 0 && (
                <>
                  <span className="text-slate-600">|</span>
                  <span>{t.coFounder} <span className="text-cyan-400 font-bold">{coOwners.join(', ')}</span></span>
                </>
              )}
              <span className="text-slate-600">|</span>
              <span>{t.created} <span className="text-slate-200 font-bold"><FormattedDate date={team.createdAt} mode="date" /></span></span>
            </span>
          </div>
          <h1 className="mt-2 font-display-league text-5xl leading-[0.92] text-white md:text-7xl [text-shadow:0_3px_14px_rgba(0,0,0,.35)]">{team.name}</h1>
          {team.slogan && (
            <p className="mt-2 flex items-center gap-1.5 font-display-condensed text-sm italic text-white/85 md:text-base">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              &quot;{team.slogan}&quot;
            </p>
          )}
          <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">{team.description || t.defaultDescription}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {team.logoUrl ? (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-black/25 p-1"
                style={{ boxShadow: `0 0 14px ${accentHex}80` }}
              >
                <Image
                  src={team.logoUrl}
                  alt={team.name}
                  width={40}
                  height={40}
                  unoptimized={!isRemoteImageOptimizable(team.logoUrl)}
                  className="h-full w-full object-contain"
                />
              </span>
            ) : (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-black/40 font-display-league text-xs text-white"
                style={{ boxShadow: `0 0 14px ${accentHex}80` }}
              >
                {initials}
              </span>
            )}
            <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 font-mono-data text-[11px] font-semibold uppercase tracking-wider text-slate-100">
              {t.drivers} {teamPilots.length || team.members.length}
            </span>
            <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 font-mono-data text-[11px] font-semibold uppercase tracking-wider text-slate-100">
              {t.leagues} {stats.leagues}
            </span>
            {team.discordUrl && (
              <a
                href={team.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-[#5865F2]/40 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5865F2] hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {t.discord}
              </a>
            )}
            {team.youtubeUrl && (
              <a
                href={team.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-[#FF0000]/40 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF0000] hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <Youtube className="h-3.5 w-3.5" />
                {t.youtube}
              </a>
            )}
            {team.instagramUrl && (
              <a
                href={team.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-[#E1306C]/40 bg-[#E1306C]/10 hover:bg-[#E1306C]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E1306C] hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <Instagram className="h-3.5 w-3.5" />
                {t.instagram}
              </a>
            )}
            {team.twitterUrl && (
              <a
                href={team.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-white/30 bg-white/10 hover:bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white rounded-lg transition-all cursor-pointer"
              >
                <Twitter className="h-3.5 w-3.5" />
                {t.twitter}
              </a>
            )}
            {team.twitchUrl && (
              <a
                href={team.twitchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-[#9146FF]/40 bg-[#9146FF]/10 hover:bg-[#9146FF]/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#9146FF] hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <Twitch className="h-3.5 w-3.5" />
                {t.twitch}
              </a>
            )}
            {team.tiktokUrl && (
              <a
                href={team.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-cyan-400/40 bg-cyan-400/10 hover:bg-cyan-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <Music2 className="h-3.5 w-3.5" />
                {t.tiktok}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {[
          { label: t.leagues.replace(':', ''), value: stats.leagues, icon: Trophy },
          { label: t.active, value: stats.activeLeagues, icon: Radio },
          { label: t.upcomingEvents, value: stats.upcomingEvents, icon: CalendarClock },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 bg-[#0f0f12] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5" style={{ color: accentHex }}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono-data text-[10.5px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
              <p className="font-display-league text-3xl leading-none text-white">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
