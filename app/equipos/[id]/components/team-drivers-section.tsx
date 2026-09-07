import Image from 'next/image'
import Link from 'next/link'
import { CenterModal } from '@/components/center-modal'
import { MessageSquare, Users, UserPlus } from 'lucide-react'
import { updateTeamMemberRole, updateTeamMemberTags, removeTeamMember, invitePilot } from '@/app/equipos/actions/team-membership'
import { acceptDriverApplicationAction, declineDriverApplicationAction } from '@/app/equipos/actions/team-market'
import { TEAM_ROLE_TAGS, type TeamPilot, type PendingApplication } from '../team-utils'
import { InvitePilotPicker } from './invite-pilot-picker'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type TeamDriversSectionProps = {
  team: any
  canManage: boolean
  teamPilots: TeamPilot[]
  pendingApplications: PendingApplication[]
  inviteCandidates: Array<{ userId: string; label: string }>
  accentSoft: string
  accentHard: string
}

export async function TeamDriversSection({
  team,
  canManage,
  teamPilots,
  pendingApplications,
  inviteCandidates,
  accentSoft,
  accentHard,
}: TeamDriversSectionProps) {
  const t = getDictionary(await getLocale()).equipos.driversSection
  const tagLabels: Record<string, string> = {
    leader: t.tagLeader,
    team_boss: t.tagTeamBoss,
    engineer: t.tagEngineer,
    HYPERCAR: t.tagHypercar,
    GT3: t.tagGt3,
    LMP2: t.tagLmp2,
  }
  const displayPilots = teamPilots.length > 0
    ? teamPilots
    : team.members.map((member: any) => ({
        userId: member.userId,
        name: member.displayName || member.steamDisplayName || member.steamId || member.userId,
        role: member.role,
        roleTags: member.roleTags || [],
        avatarUrl: (member as any).avatarUrl || null,
        steamId: member.steamId || null,
      }))

  return (
    <article className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display-league text-2xl text-white">{t.title}</h2>
        {canManage ? (
          <div className="relative">
            <CenterModal
              title={t.driverManagementTitle}
              triggerLabel={t.manageDrivers}
              triggerClassName="inline-flex items-center gap-1.5 border bg-black/40 hover:bg-white/5 px-4 py-2.5 text-xs font-bold uppercase italic rounded-lg transition-colors cursor-pointer shrink-0"
              triggerStyle={{ borderColor: accentHard, color: '#fff', boxShadow: `0 0 16px ${accentHard}` }}
              widthClassName="w-[min(920px,94vw)]"
            >
              <div className="space-y-6 text-left p-1 bg-[#090d16] text-white">
                {/* Section 1: Team Members List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-400" />
                      {t.teamDriversMembers}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-lg">
                      {team.members.length} {team.members.length === 1 ? t.memberOne : t.memberMany}
                    </span>
                  </div>

                  {team.members.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">{t.noMembers}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {team.members.map((member: any) => {
                        const memberName = member.displayName || member.steamDisplayName || member.steamId || member.userId
                        const avatar = (member as any).avatarUrl || null

                        return (
                          <div
                            key={member.id}
                            className="bg-[#0f172a]/90 border border-slate-800 rounded-lg p-3.5 space-y-3 shadow-sm hover:border-slate-700 transition-all"
                          >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {avatar ? (
                                <Image src={avatar} alt={memberName} width={40} height={40} unoptimized className="w-10 h-10 object-cover rounded-lg border border-slate-700" />
                              ) : (
                                <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-xs font-bold text-slate-300">
                                  {memberName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <Link
                                  href={`/perfil/${member.userId}`}
                                  className="text-sm font-bold text-white leading-tight hover:text-cyan-400 hover:underline transition-colors"
                                >
                                  {memberName}
                                </Link>
                                <p className="text-[10px] font-mono text-cyan-400/80 mt-0.5">
                                  {t.steamId} {member.steamId || member.userId.replace('steam_', '')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {member.role !== 'owner' ? (
                                <form action={updateTeamMemberRole} className="flex items-center gap-2">
                                  <input type="hidden" name="teamId" value={team.id} />
                                  <input type="hidden" name="memberUserId" value={member.userId} />
                                  <input type="hidden" name="redirectTo" value={`/equipos/${team.id}`} />
                                  <select
                                    name="role"
                                    defaultValue={member.role}
                                    className="bg-[#141d31] border border-slate-700 focus:border-cyan-400 text-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                                  >
                                    <option value="driver">{t.driverRole}</option>
                                    <option value="manager">{t.managerRole}</option>
                                  </select>
                                  <button className="bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                                    {t.saveRole}
                                  </button>
                                </form>
                              ) : (
                                <span className="bg-amber-500/10 border border-amber-500/40 text-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg">
                                  {t.ownerLeader}
                                </span>
                              )}

                              {member.role !== 'owner' && (
                                <form action={removeTeamMember}>
                                  <input type="hidden" name="teamId" value={team.id} />
                                  <input type="hidden" name="memberUserId" value={member.userId} />
                                  <input type="hidden" name="redirectTo" value={`/equipos/${team.id}`} />
                                  <button className="bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                                    {t.kick}
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>

                          <form action={updateTeamMemberTags} className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <input type="hidden" name="teamId" value={team.id} />
                            <input type="hidden" name="memberUserId" value={member.userId} />
                            <input type="hidden" name="redirectTo" value={`/equipos/${team.id}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">{t.roleTagsLabel}</span>
                            {TEAM_ROLE_TAGS.map((tag) => (
                              <label key={tag} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  name="roleTags"
                                  value={tag}
                                  defaultChecked={((member as any).roleTags || []).includes(tag)}
                                  className="h-3.5 w-3.5 rounded border-slate-600 bg-[#141d31] accent-cyan-500 cursor-pointer"
                                />
                                {tagLabels[tag]}
                              </label>
                            ))}
                            <button className="ml-auto bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0">
                              {t.saveTags}
                            </button>
                          </form>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section 1.5: Invite a member */}
                <div className="bg-[#0c1220] border border-slate-800/90 rounded-lg p-4 space-y-3 shadow-md">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <UserPlus className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">{t.inviteTitle}</h3>
                  </div>

                  <form action={invitePilot} className="space-y-3">
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="redirectTo" value={`/equipos/${team.id}`} />

                    {inviteCandidates.length > 0 ? (
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {t.inviteExistingLabel}
                        </label>
                        <InvitePilotPicker
                          candidates={inviteCandidates}
                          searchPlaceholder={t.inviteSearchPlaceholder}
                          selectPlaceholder={t.inviteExistingPlaceholder}
                          noResultsText={t.inviteNoSearchResults}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">{t.noCandidates}</p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      <span className="h-px flex-1 bg-slate-800" />
                      {t.inviteOr}
                      <span className="h-px flex-1 bg-slate-800" />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {t.inviteSteamIdLabel}
                      </label>
                      <input
                        type="text"
                        name="steamId"
                        placeholder={t.inviteSteamIdPlaceholder}
                        className="w-full bg-[#141d31] border border-slate-700 focus:border-cyan-400 text-slate-200 text-xs font-mono rounded-lg px-3 py-2 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {t.inviteMessageLabel}
                      </label>
                      <textarea
                        name="message"
                        rows={2}
                        placeholder={t.inviteMessagePlaceholder}
                        className="w-full resize-none bg-[#141d31] border border-slate-700 focus:border-cyan-400 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
                      />
                    </div>

                    <button className="w-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
                      {t.sendInvite}
                    </button>
                  </form>
                </div>

                {/* Section 2: Pending Applications from Driver Market */}
                <div className="bg-[#0c1220] border border-slate-800/90 rounded-lg p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-amber-400" />
                      {t.pendingApplicationsTitle}
                    </h3>
                    {pendingApplications.length > 0 && (
                      <span className="text-[10px] font-black bg-amber-500 text-black px-2.5 py-0.5 rounded-lg uppercase">
                        {pendingApplications.length} {pendingApplications.length > 1 ? t.applicationMany : t.applicationOne}
                      </span>
                    )}
                  </div>

                  {pendingApplications.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">{t.noPendingApplications}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingApplications.map((app) => (
                        <div key={app.id} className="bg-[#141d31]/90 border border-slate-700/60 p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-start gap-3">
                            {app.userAvatar ? (
                              <Image src={app.userAvatar} width={40} height={40} unoptimized className="w-10 h-10 object-cover border border-slate-700 rounded-lg shrink-0" alt="" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 rounded-lg shrink-0">
                                {app.userName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-white leading-tight">{app.userName}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{t.contact} <span className="text-cyan-400 font-semibold">{app.contactInfo}</span></p>
                              {app.message && (
                                <div className="mt-1.5 p-2 bg-[#0a0f1d] border border-slate-800 text-[11px] text-slate-300 rounded-lg max-w-md">
                                  <span className="text-slate-500 font-semibold text-[9px] uppercase tracking-wider block mb-0.5">{t.driverMessage}</span>
                                  &quot;{app.message}&quot;
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <form action={acceptDriverApplicationAction}>
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="applicationId" value={app.id} />
                              <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-sm">
                                {t.acceptHire}
                              </button>
                            </form>
                            <form action={declineDriverApplicationAction}>
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="applicationId" value={app.id} />
                              <button className="border border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300 font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-all cursor-pointer">
                                {t.decline}
                              </button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CenterModal>
            {pendingApplications.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-black leading-none shadow-md">
                {pendingApplications.length}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Visual Alert of Pending Applications for Leaders */}
      {canManage && pendingApplications.length > 0 && (
        <div className="mb-4 border border-amber-500/40 bg-amber-500/5 p-4 rounded-lg text-left">
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              {t.newApplicationAlert}
            </div>
            <span className="text-[10px] font-black bg-amber-500 text-black px-2 py-0.5 uppercase tracking-wider">
              {pendingApplications.length} {pendingApplications.length > 1 ? t.applicationMany : t.applicationOne}
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            {pendingApplications.map((app) => (
              <div key={app.id} className="bg-black/40 border border-shell-line p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg">
                <div className="flex items-center gap-3">
                  {app.userAvatar ? (
                    <Image src={app.userAvatar} width={36} height={36} unoptimized className="w-9 h-9 object-cover border border-white/10 rounded-lg" alt="" />
                  ) : (
                    <div className="w-9 h-9 bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-slate-400 rounded-lg">D</div>
                  )}
                  <div>
                    <p className="text-sm font-black text-white leading-tight">{app.userName}</p>
                    <p className="text-xs text-slate-400 mt-1">{t.contact} <span className="text-cyan-400 font-semibold">{app.contactInfo}</span></p>
                    {app.message && (
                      <div className="mt-1.5 p-1.5 bg-zinc-950/50 border border-shell-line/40 text-xxs text-slate-300 rounded-lg max-w-md">
                        <span className="text-slate-500 font-semibold uppercase block tracking-wider text-[9px] mb-0.5">{t.driverMessage}</span>
                        &quot;{app.message}&quot;
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <form action={acceptDriverApplicationAction}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="applicationId" value={app.id} />
                    <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg cursor-pointer transition-colors">
                      {t.acceptHire}
                    </button>
                  </form>
                  <form action={declineDriverApplicationAction}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="applicationId" value={app.id} />
                    <button className="border border-shell-line hover:bg-white/5 text-slate-300 font-bold text-[10px] px-3 py-1.5 uppercase tracking-wider rounded-lg cursor-pointer transition-colors">
                      {t.decline}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drivers display list — poster cards in a horizontal strip */}
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {displayPilots.length === 0 ? (
          <p className="text-sm text-slate-300">{t.noDriversRegistered}</p>
        ) : (
          displayPilots.map((pilot: any) => (
            <div
              key={pilot.userId}
              className="w-[150px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#111114]"
            >
              <div
                className="flex h-20 items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${accentSoft}, rgba(10,10,12,0.9))` }}
              >
                {pilot.avatarUrl ? (
                  <Image src={pilot.avatarUrl} alt={pilot.name} width={56} height={56} unoptimized className="h-14 w-14 rounded-lg border border-white/25 object-cover" />
                ) : (
                  <span className="font-display-league text-3xl text-white">{pilot.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate font-display-condensed text-sm font-bold text-white">{pilot.name}</p>
                <p className="mt-0.5 font-mono-data text-[9px] uppercase tracking-wider text-slate-500">
                  {pilot.role === 'owner'
                    ? t.ownerLeader
                    : pilot.role === 'manager'
                    ? t.managerCoFounder
                    : t.driverBadge}
                </p>
                {(pilot.roleTags || []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(pilot.roleTags as string[]).map((tag) => (
                      <span key={tag} className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono-data text-[8px] font-bold uppercase tracking-wider text-cyan-300">
                        {tagLabels[tag] || tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  )
}
