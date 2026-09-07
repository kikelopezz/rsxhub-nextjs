'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

type Candidate = { userId: string; label: string }

type InvitePilotPickerProps = {
  candidates: Candidate[]
  searchPlaceholder: string
  selectPlaceholder: string
  noResultsText: string
}

export function InvitePilotPicker({ candidates, searchPlaceholder, selectPlaceholder, noResultsText }: InvitePilotPickerProps) {
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')

  const filteredCandidates = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return candidates
    return candidates.filter((candidate) => candidate.label.toLowerCase().includes(s))
  }, [candidates, search])

  return (
    <div className="space-y-2">
      <input type="hidden" name="invitedUserId" value={selectedUserId} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-[#141d31] border border-slate-700 focus:border-cyan-400 text-slate-200 text-xs font-semibold rounded-lg py-2 pl-8 pr-3 outline-none"
        />
      </div>

      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-[#141d31]">
        {filteredCandidates.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-slate-500">{noResultsText}</p>
        ) : (
          filteredCandidates.map((candidate) => (
            <button
              key={candidate.userId}
              type="button"
              onClick={() => setSelectedUserId(candidate.userId === selectedUserId ? '' : candidate.userId)}
              className={`block w-full cursor-pointer truncate px-3 py-2 text-left text-xs font-semibold transition-colors ${
                candidate.userId === selectedUserId
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              {candidate.label}
            </button>
          ))
        )}
      </div>

      {!selectedUserId && <p className="text-[10px] italic text-slate-500">{selectPlaceholder}</p>}
    </div>
  )
}
