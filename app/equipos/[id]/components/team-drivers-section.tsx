import Image from 'next/image'
import { CenterModal } from '@/components/center-modal'
import { MessageSquare, Users } from 'lucide-react'
import { updateTeamMemberRole, removeTeamMember } from '@/app/equipos/actions/team-membership'
import { acceptDriverApplicationAction, declineDriverApplicationAction } from '@/app/equipos/actions/team-market'
import type { TeamPilot, PendingApplication } from '../team-utils'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

type TeamDriversSectionProps = {
  team: any
  canManage: boolean
  teamPilots: TeamPilot[]
  pendingApplications: PendingApplication[]
  accentSoft: string
}

export async function TeamDriversSection({
  team,
  canManage,
  teamPilots,
  pendingApplications,
  accentSoft,
}: TeamDriversSectionProps) {
  const t = getDictionary(await getLocale()).equipos.driversSection
  const displayPilots = teamPilots.length > 0
    ? teamPilots
    : team.members.map((member: any) => ({
        userId: member.userId,
        name: member.displayName || member.steamDisplayName || member.steamId || member.userId,
        role: member.role,
        avatarUrl: (member as any).avatarUrl || null,
        steamId: member.steamId || null,
      }))

  return (
    <article className="hud-corners shell-panel p-4 md:p-5 rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black uppercase italic text-white">{t.title}</h2>
        {canManage ? (
          <div className="relative">
            <CenterModal
              title={t.driverManagementTitle}
              triggerLabel={t.manageDrivers}
              triggerClassName="inline-flex items-center gap-1.5 border border-cyan-500 bg-cyan-950/40 hover:bg-cyan-500/20 px-4 py-2.5 text-xs font-bold uppercase italic text-cyan-300 rounded-lg transition-colors cursor-pointer shrink-0"
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
                            className="bg-[#0f172a]/90 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              {avatar ? (
                                <Image src={avatar} alt={memberName} width={40} height={40} className="w-10 h-10 object-cover rounded-lg border border-slate-700" />
                              ) : (
                                <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-xs font-bold text-slate-300">
                                  {memberName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-bold text-white leading-tight">{memberName}</p>
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
                        )
                      })}
                    </div>
                  )}
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
                              <Image src={app.userAvatar} width={40} height={40} className="w-10 h-10 object-cover border border-slate-700 rounded-lg shrink-0" alt="" />
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
                    <Image src={app.userAvatar} width={36} height={36} className="w-9 h-9 object-cover border border-white/10 rounded-lg" alt="" />
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

      {/* Drivers display list */}
      <div className="mt-3 space-y-2">
        {displayPilots.length === 0 ? (
          <p className="text-sm text-slate-300">{t.noDriversRegistered}</p>
        ) : (
          displayPilots.map((pilot: any) => (
            <div
              key={pilot.userId}
              className="flex items-center gap-3 border border-shell-line px-3 py-2 rounded-lg"
              style={{ background: `linear-gradient(110deg, ${accentSoft} 0%, rgba(8,15,25,0.76) 50%, rgba(8,15,25,0.96) 100%)` }}
            >
              {pilot.avatarUrl ? (
                <Image src={pilot.avatarUrl} alt={pilot.name} width={56} height={56} className="h-14 w-14 border border-white/25 object-cover rounded-lg font-sans" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center border border-white/20 bg-white/10 text-lg font-bold text-white rounded-lg font-sans">
                  {pilot.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-lg font-black uppercase italic text-white leading-tight">{pilot.name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    {pilot.role === 'owner'
                      ? t.ownerLeader
                      : pilot.role === 'manager'
                      ? t.managerCoFounder
                      : t.driverBadge}
                  </span>
                  {pilot.steamId && (
                    <>
                      <span className="text-slate-600 text-[10px]">•</span>
                      <span className="text-slate-400 font-mono text-[10px]">{t.steamId} {pilot.steamId}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  )
}
