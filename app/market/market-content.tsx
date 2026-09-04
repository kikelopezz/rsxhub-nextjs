'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Send, Shield, User, Check, AlertCircle } from 'lucide-react'
import {
  createMarketListing,
  deleteMarketListing,
  applyToTeamListingAction,
  withdrawApplicationAction,
  inviteDriverFromListingAction,
} from './actions'
import { MarketDriverCards, Listing, ManagedTeam } from './components/market-driver-cards'
import { MarketTeamOffers, MarketApplication } from './components/market-team-offers'
import { useDictionary } from '@/lib/i18n/locale-provider'

type MarketInvite = {
  id: string
  listingId: string
  teamId: string
  teamName: string
  teamLogo: string | null
  invitedUserId: string
  invitedByUserId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

type Props = {
  listings: Listing[]
  currentUser: {
    userId: string
    steamDisplayName: string
    avatarUrl: string | null
  } | null
  myTeams: ManagedTeam[]
  applications: MarketApplication[]
  invites: MarketInvite[]
  belongsToTeam?: boolean
}

const CLASS_OPTIONS = ['ALL', 'GT3', 'HYPERCAR', 'FORMULA', 'LMP2']

export default function MarketPageContent({
  listings,
  currentUser,
  myTeams,
  applications,
  invites,
  belongsToTeam = false
}: Props) {
  const router = useRouter()
  const tr = useDictionary().market.content
  const [activeTab, setActiveTab] = useState<'team' | 'driver'>('team')
  const [simFilter, setSimFilter] = useState<'all' | 'ac' | 'lmu'>('all')
  const [classFilter, setClassFilter] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [myApps, setMyApps] = useState<MarketApplication[]>(applications)

  useEffect(() => {
    setMyApps(applications)
  }, [applications])

  const hasOwnedTeam = myTeams.length > 0

  // Form states
  const [formType, setFormType] = useState<'team_seeking_driver' | 'driver_seeking_team'>(
    hasOwnedTeam ? 'team_seeking_driver' : 'driver_seeking_team'
  )

  useEffect(() => {
    setFormType(hasOwnedTeam ? 'team_seeking_driver' : 'driver_seeking_team')
  }, [hasOwnedTeam])

  const [formSim, setFormSim] = useState<'ac' | 'lmu'>('ac')
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['GT3'])
  const [formTeamId, setFormTeamId] = useState(myTeams[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Application & Invite modal states
  const [applyingListingId, setApplyingListingId] = useState<string | null>(null)
  const [applyMessage, setApplyMessage] = useState('')
  const [activeInviteListingId, setActiveInviteListingId] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState('')

  const handleClassToggle = (tag: string) => {
    setSelectedClasses((prev) => {
      if (prev.includes(tag)) {
        if (prev.length === 1) return prev
        return prev.filter((t) => t !== tag)
      }
      return [...prev, tag]
    })
  }

  const filteredListings = listings.filter((item) => {
    const matchesTab =
      activeTab === 'team' ? item.type === 'team_seeking_driver' : item.type === 'driver_seeking_team'
    const matchesSim = simFilter === 'all' ? true : item.main_sim === simFilter
    const matchesClass =
      classFilter === 'ALL'
        ? true
        : String(item.class_tag || '')
            .toUpperCase()
            .split(',')
            .map((t) => t.trim())
            .includes(classFilter.toUpperCase())
    return matchesTab && matchesSim && matchesClass
  })

  const teamsCount = listings.filter((item) => item.type === 'team_seeking_driver').length
  const driversCount = listings.filter((item) => item.type === 'driver_seeking_team').length

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    const formData = new FormData(e.currentTarget)
    formData.set('type', formType)
    formData.set('mainSim', formSim)
    formData.set('classTag', selectedClasses.join(','))
    if (formType === 'team_seeking_driver') {
      formData.set('teamId', formTeamId || myTeams[0]?.id || '')
    }

    try {
      await createMarketListing(formData)
      setIsModalOpen(false)
    } catch (err: any) {
      setErrorMessage(err.message || tr.createListingFailed)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm(tr.deleteListingConfirm)) {
      try {
        await deleteMarketListing(id)
      } catch (err) {
        alert(tr.deleteListingFailed)
      }
    }
  }

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!applyingListingId) return
    setIsSubmitting(true)
    try {
      await applyToTeamListingAction(applyingListingId, applyMessage)
      setApplyingListingId(null)
      setApplyMessage('')
    } catch (err: any) {
      alert(err.message || tr.applyErrorGeneric)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeInviteListingId || myTeams.length === 0) return
    setIsSubmitting(true)
    try {
      await inviteDriverFromListingAction(activeInviteListingId, myTeams[0].id, inviteMessage)
      setActiveInviteListingId(null)
      setInviteMessage('')
    } catch (err: any) {
      alert(err.message || tr.inviteErrorGeneric)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdrawApplication = async (listingId: string, applicationId?: string) => {
    if (confirm(tr.withdrawApplicationConfirm)) {
      // Optimistic client update
      setMyApps((prev) =>
        prev.filter(
          (a) =>
            !(
              (applicationId && a.id === applicationId) ||
              (a.listingId === listingId || a.teamId === listingId || a.id === listingId)
            )
        )
      )
      try {
        await withdrawApplicationAction(listingId, applicationId)
        router.refresh()
      } catch (err) {
        console.error('Failed to withdraw application:', err)
        alert(tr.withdrawApplicationError)
        setMyApps(applications)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header — big poster-style title, stats as an inline mono line */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display-league text-[42px] leading-[0.95] text-white md:text-[52px]">{tr.title}</h1>
          <p className="mt-2 max-w-xl font-mono-data text-xs text-slate-500">{tr.subtitle}</p>
          <p className="mt-2 font-mono-data text-[11px] uppercase tracking-wider text-slate-500">
            {teamsCount} {tr.teamsLookingForDrivers.toLowerCase()} · {driversCount} {tr.driversLookingForTeam.toLowerCase()}
          </p>
        </div>

        {currentUser && (
          belongsToTeam && !hasOwnedTeam ? (
            <button
              disabled
              title={tr.cannotCreateListingTitle}
              className="shrink-0 bg-white/5 border border-white/10 text-slate-500 px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-xl cursor-not-allowed font-display-condensed"
            >
              {tr.alreadyInTeam}
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 bg-white hover:bg-slate-200 text-black px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 cursor-pointer font-display-condensed"
            >
              <Plus className="h-4 w-4" />
              {hasOwnedTeam ? tr.postTeamListing : tr.postDriverListing}
            </button>
          )
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0a0a0c] p-1.5">
          <button
            onClick={() => setActiveTab('team')}
            className={`rounded-lg px-5 py-2 font-display-condensed text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'team'
                ? 'bg-white text-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tr.teamsLookingForDrivers} ({teamsCount})
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`rounded-lg px-5 py-2 font-display-condensed text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'driver'
                ? 'bg-white text-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tr.driversLookingForTeam} ({driversCount})
          </button>
        </div>
      </div>

      {/* Class & Sim Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">{tr.category}</span>
          {CLASS_OPTIONS.map((cls) => {
            const isSelected = classFilter === cls
            let pillStyle = 'bg-black/40 text-slate-400 border-white/10 hover:text-white'

            if (cls === 'ALL') {
              pillStyle = isSelected
                ? 'bg-white text-black font-black shadow-sm'
                : 'bg-black/40 text-slate-400 border-white/10 hover:text-white'
            } else if (isSelected) {
              if (cls === 'GT3') pillStyle = 'bg-[#009f00] text-white border-green-400 font-black italic shadow-[0_0_12px_rgba(0,159,0,0.35)]'
              else if (cls === 'HYPERCAR') pillStyle = 'bg-[#e10600] text-white border-red-500 font-black italic shadow-[0_0_12px_rgba(225,6,0,0.35)]'
              else if (cls === 'FORMULA') pillStyle = 'bg-[#9333ea] text-white border-purple-400 font-black italic shadow-[0_0_12px_rgba(147,51,234,0.35)]'
              else if (cls === 'LMP2') pillStyle = 'bg-[#0072f0] text-white border-blue-400 font-black italic shadow-[0_0_12px_rgba(0,114,240,0.35)]'
            } else {
              if (cls === 'GT3') pillStyle = 'bg-black/50 text-slate-400 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-400'
              else if (cls === 'HYPERCAR') pillStyle = 'bg-black/50 text-slate-400 border-red-500/30 hover:border-red-500 hover:text-red-400'
              else if (cls === 'FORMULA') pillStyle = 'bg-black/50 text-slate-400 border-purple-500/30 hover:border-purple-500 hover:text-purple-400'
              else if (cls === 'LMP2') pillStyle = 'bg-black/50 text-slate-400 border-blue-500/30 hover:border-blue-500 hover:text-blue-400'
            }

            return (
              <button
                key={cls}
                onClick={() => setClassFilter(cls)}
                className={`rounded-md border px-3.5 py-1.5 text-[11px] font-extrabold uppercase transition-all ${pillStyle}`}
              >
                {cls}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">{tr.sim}</span>
          {(['all', 'ac', 'lmu'] as const).map((sim) => (
            <button
              key={sim}
              onClick={() => setSimFilter(sim)}
              className={`rounded-md px-3.5 py-1.5 text-[11px] font-extrabold uppercase transition-all ${
                simFilter === sim
                  ? 'bg-white text-black'
                  : 'bg-black/40 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              {sim === 'all' ? tr.all : sim.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Listings Grid */}
      {filteredListings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0a0c] p-8 text-center">
          <p className="text-sm text-slate-400">{tr.noListings}</p>
        </div>
      ) : activeTab === 'team' ? (
        <MarketTeamOffers
          listings={filteredListings}
          currentUserId={currentUser?.userId}
          applications={myApps}
          belongsToTeam={belongsToTeam || hasOwnedTeam}
          onDeleteListing={handleDelete}
          onApplyClick={(id) => setApplyingListingId(id)}
          onWithdrawApplication={handleWithdrawApplication}
        />
      ) : (
        <MarketDriverCards
          listings={filteredListings}
          currentUserId={currentUser?.userId}
          myTeams={myTeams}
          invites={invites}
          onDeleteListing={handleDelete}
          onInviteClick={(id) => setActiveInviteListingId(id)}
        />
      )}

      {/* Create Listing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-start md:items-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in">
          <div className="shell-panel border border-shell-line bg-[#090d16] max-w-xl w-full p-4 md:p-5 text-white rounded-lg relative shadow-2xl my-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-2 border-b border-shell-line pb-2.5 mb-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                {hasOwnedTeam ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </span>
              <h2 className="text-sm font-bold tracking-tight text-white">
                {hasOwnedTeam ? tr.postTeamOffer : tr.postDriverApplication}
              </h2>
            </div>

            {errorMessage && (
              <div className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2.5">
              {hasOwnedTeam && myTeams.length > 0 && (
                <div>
                  <label className="mb-0.5 block text-[11px] text-slate-300 uppercase font-bold tracking-wider">{tr.managingTeam}</label>
                  <select
                    value={formTeamId}
                    onChange={(e) => setFormTeamId(e.target.value)}
                    className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-1.5 text-xs text-white outline-none font-bold focus:border-accent transition-colors"
                  >
                    {myTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-0.5 block text-[11px] text-slate-300 uppercase font-bold tracking-wider">{tr.listingTitle}</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder={
                    hasOwnedTeam
                      ? tr.listingTitlePlaceholderTeam
                      : tr.listingTitlePlaceholderDriver
                  }
                  className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-0.5 block text-[11px] text-slate-300 uppercase font-bold tracking-wider">
                    {tr.primarySimulator}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormSim('ac')}
                      className={`px-2 py-1.5 border text-center text-xs font-bold uppercase tracking-wide transition-all cursor-pointer rounded-lg ${
                        formSim === 'ac'
                          ? 'border-accent bg-accent/10 text-white'
                          : 'border-shell-line bg-black/40 text-slate-400 hover:text-white hover:border-slate-400'
                      }`}
                    >
                      {tr.assettoCorsa}
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormSim('lmu')}
                      className={`px-2 py-1.5 border text-center text-xs font-bold uppercase tracking-wide transition-all cursor-pointer rounded-lg ${
                        formSim === 'lmu'
                          ? 'border-accent bg-accent/10 text-white'
                          : 'border-shell-line bg-black/40 text-slate-400 hover:text-white hover:border-slate-400'
                      }`}
                    >
                      {tr.leMansUltimate}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-0.5 block text-[11px] text-slate-300 uppercase font-bold tracking-wider">{tr.categories}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['GT3', 'HYPERCAR', 'FORMULA', 'LMP2'].map((tag) => {
                      const isSelected = selectedClasses.includes(tag)
                      let style = 'bg-black/40 text-slate-400 border-shell-line hover:text-white'

                      if (isSelected) {
                        if (tag === 'GT3') style = 'bg-[#009f00] text-white border-green-400 font-extrabold italic'
                        else if (tag === 'HYPERCAR') style = 'bg-[#e10600] text-white border-red-500 font-extrabold italic'
                        else if (tag === 'FORMULA') style = 'bg-[#9333ea] text-white border-purple-400 font-extrabold italic'
                        else if (tag === 'LMP2') style = 'bg-[#0072f0] text-white border-blue-400 font-extrabold italic'
                      } else {
                        if (tag === 'GT3') style = 'bg-black/50 text-slate-400 border-emerald-500/30 hover:border-emerald-500 hover:text-emerald-400'
                        else if (tag === 'HYPERCAR') style = 'bg-black/50 text-slate-400 border-red-500/30 hover:border-red-500 hover:text-red-400'
                        else if (tag === 'FORMULA') style = 'bg-black/50 text-slate-400 border-purple-500/30 hover:border-purple-500 hover:text-purple-400'
                        else if (tag === 'LMP2') style = 'bg-black/50 text-slate-400 border-blue-500/30 hover:border-blue-500 hover:text-blue-400'
                      }

                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => handleClassToggle(tag)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] uppercase tracking-wider transition-all cursor-pointer border ${style}`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-0.5 block text-[11px] text-slate-300 uppercase font-bold tracking-wider">{tr.bioDescription}</label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder={
                    hasOwnedTeam
                      ? tr.bioPlaceholderTeam
                      : tr.bioPlaceholderDriver
                  }
                  className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-accent transition-colors resize-y"
                />
              </div>

              <div>
                <label className="mb-0.5 block text-[11px] text-slate-300 uppercase font-bold tracking-wider">
                  {tr.discordContact} {!hasOwnedTeam && <span className="text-accent font-extrabold">{tr.required}</span>}
                </label>
                <input
                  type="text"
                  name="contactInfo"
                  required
                  placeholder={tr.contactPlaceholder}
                  className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-1.5 text-xs text-white outline-none font-mono focus:border-accent transition-colors"
                />
                {!hasOwnedTeam && (
                  <p className="mt-1 text-[10px] text-amber-400 font-medium">
                    {tr.discordHint}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2.5 border-t border-shell-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-shell-line px-5 py-2.5 text-xs font-bold uppercase hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {tr.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#1274de] hover:bg-[#1f82ee] disabled:bg-accent/40 text-white font-bold px-6 py-2.5 text-xs uppercase transition-colors cursor-pointer shadow-[0_0_15px_rgba(18,116,222,0.4)]"
                >
                  {isSubmitting ? tr.posting : tr.postListing}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {applyingListingId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-start md:items-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in">
          <div className="shell-panel border border-shell-line bg-[#090d16] max-w-md w-full p-6 text-white rounded-lg relative shadow-2xl space-y-5 my-auto">
            <button onClick={() => setApplyingListingId(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <Send className="h-4 w-4 text-accent" />
              {tr.applyToTeamOffer}
            </h3>

            <form onSubmit={handleApplySubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs text-slate-300 uppercase font-bold tracking-wider">{tr.messageForTeamOwner}</label>
                <textarea
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  rows={3}
                  placeholder={tr.applyMessagePlaceholder}
                  className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-accent transition-colors resize-y"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-shell-line">
                <button
                  type="button"
                  onClick={() => setApplyingListingId(null)}
                  className="rounded-lg border border-shell-line px-4 py-2 text-xs font-bold uppercase hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {tr.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#1274de] hover:bg-[#1f82ee] disabled:bg-accent/40 text-white font-bold px-5 py-2 text-xs uppercase transition-colors cursor-pointer"
                >
                  {isSubmitting ? tr.sending : tr.sendApplication}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {activeInviteListingId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex justify-center items-start md:items-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in">
          <div className="shell-panel border border-shell-line bg-[#090d16] max-w-md w-full p-6 text-white rounded-lg relative shadow-2xl space-y-5 my-auto">
            <button onClick={() => setActiveInviteListingId(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              {tr.inviteDriverToTeam}
            </h3>

            <form onSubmit={handleInviteSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs text-slate-300 uppercase font-bold tracking-wider">{tr.invitationMessage}</label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  rows={3}
                  placeholder={tr.inviteMessagePlaceholder}
                  className="w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-accent transition-colors resize-y"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-shell-line">
                <button
                  type="button"
                  onClick={() => setActiveInviteListingId(null)}
                  className="rounded-lg border border-shell-line px-4 py-2 text-xs font-bold uppercase hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {tr.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#1274de] hover:bg-[#1f82ee] disabled:bg-accent/40 text-white font-bold px-5 py-2 text-xs uppercase transition-colors cursor-pointer"
                >
                  {isSubmitting ? tr.sending : tr.sendInvitation}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
