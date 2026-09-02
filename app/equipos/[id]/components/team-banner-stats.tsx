import Link from 'next/link'
import Image from 'next/image'
import { CenterModal } from '@/components/center-modal'
import { ImagePicker } from '@/components/image-picker'
import { DeleteTeamButton } from '@/components/delete-team-button'
import { FormattedDate } from '@/components/formatted-date'
import { Sparkles, Youtube, MessageSquare, Trophy, Radio, CalendarClock, Instagram, Twitter, Twitch, Music2 } from 'lucide-react'
import { updateTeam, deleteTeamAction } from '@/app/equipos/actions/team-crud'
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
  leagueParticipation: Array<{ bannerUrl: string | null }>
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
  leagueParticipation,
}: TeamBannerStatsProps) {
  const t = getDictionary(await getLocale()).equipos.bannerStats
  const heroImage = (() => {
    if (team.bannerUrl || team.banner_url) return team.bannerUrl || team.banner_url
    if (leagueParticipation[0]?.bannerUrl) return leagueParticipation[0].bannerUrl
    if (team.logoUrl) return team.logoUrl
    if (Array.isArray(team.carSkinUrls)) {
      const validImg = team.carSkinUrls.find((url: string) => /\.(png|jpe?g|webp|svg)$/i.test(url))
      if (validImg) return validImg
    }
    return ''
  })()

  return (
    <section className="hud-corners overflow-hidden border border-shell-line bg-[#070d17] rounded-lg shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <div
        className="relative min-h-[320px] overflow-hidden p-6 md:min-h-[400px] md:p-9"
        style={{
          backgroundImage: `linear-gradient(112deg, rgba(6,10,17,0.94) 20%, ${accentSoft} 58%, rgba(6,10,17,0.86) 100%), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
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
                  />
                  <ImagePicker
                    name="bannerUrl"
                    label={t.teamBanner}
                    defaultValue={team.bannerUrl || team.banner_url || ''}
                  />
                </div>

                {/* Accent Color Selection */}
                <div>
                  <label className="mb-2 block text-xs text-slate-355 uppercase tracking-wider font-semibold text-left font-sans font-extrabold text-[#00f0ff] animate-pulse">
                    {t.accentColor}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { name: 'Neon Blue', hex: '#00f0ff', colorText: 'text-[#00f0ff]' },
                      { name: 'Neon Pink', hex: '#ff007f', colorText: 'text-[#ff007f]' },
                      { name: 'Electric Lime', hex: '#39ff14', colorText: 'text-[#39ff14]' },
                      { name: 'Fiery Orange', hex: '#ff5500', colorText: 'text-[#ff5500]' },
                      { name: 'Golden Yellow', hex: '#ffea00', colorText: 'text-[#ffea00]' },
                      { name: 'Acid Purple', hex: '#b026ff', colorText: 'text-[#b026ff]' },
                    ].map((color) => (
                      <label
                        key={color.hex}
                        className={`flex items-center gap-2 border bg-black/30 p-2.5 text-xs text-slate-300 hover:bg-white/5 cursor-pointer rounded-lg select-none text-left transition-all ${
                          team.accentColor === color.hex ? 'border-white bg-white/5' : 'border-shell-line'
                        }`}
                      >
                        <input
                          type="radio"
                          name="accentColor"
                          value={color.hex}
                          defaultChecked={team.accentColor === color.hex || (!team.accentColor && color.hex === '#00f0ff')}
                          className="h-3 w-3 border border-shell-line text-slate-200 bg-transparent focus:ring-0 cursor-pointer"
                        />
                        <span className={`font-black uppercase tracking-wide text-[10px] ${color.colorText}`}>
                          {color.name}
                        </span>
                      </label>
                    ))}
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
                  <button className="bg-shell-accent hover:bg-red-700 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition-colors cursor-pointer">
                    {t.saveChanges}
                  </button>
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
          <h1 className="mt-2 text-4xl font-black uppercase italic leading-[0.95] text-white md:text-7xl">{team.name}</h1>
          {team.slogan && (
            <p className="mt-2 text-xs md:text-sm font-bold tracking-[0.2em] text-[#00f0ff] uppercase italic flex items-center gap-1.5 animate-pulse">
              <Sparkles className="h-3.5 w-3.5 text-[#00f0ff] shrink-0" />
              &quot;{team.slogan}&quot;
            </p>
          )}
          <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">{team.description || t.defaultDescription}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {team.logoUrl ? (
              <span className="inline-flex h-10 w-10 items-center justify-center border border-white/25 bg-black/25 p-1 rounded-lg shadow-sm">
                <Image src={team.logoUrl} alt={team.name} width={40} height={40} className="h-full w-full object-contain" />
              </span>
            ) : (
              <span className="inline-flex h-10 w-10 items-center justify-center border border-white/25 bg-black/40 text-xs font-black tracking-wider text-cyan-300 rounded-lg shadow-sm">
                {team.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="border border-white/20 bg-black/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-100 rounded-lg">
              {t.drivers} {teamPilots.length || team.members.length}
            </span>
            <span className="border border-white/20 bg-black/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-100 rounded-lg">
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
      <div className="grid gap-[1px] bg-shell-line md:grid-cols-3">
        {[
          { label: t.leagues.replace(':', ''), value: stats.leagues, icon: Trophy },
          { label: t.active, value: stats.activeLeagues, icon: Radio },
          { label: t.upcomingEvents, value: stats.upcomingEvents, icon: CalendarClock },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 bg-[#0b1320] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/5" style={{ color: accentHard }}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              <p className="text-2xl font-black italic leading-none text-white">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
