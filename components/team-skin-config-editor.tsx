'use client'

import { useMemo, useState } from 'react'

type SkinProfile = {
  skinUrl: string
  leagueSlug: string
  carNumber: string
}

type LeagueOption = {
  slug: string
  title: string
}

function normalizeProfiles(input: SkinProfile[]) {
  return input
    .map((row) => ({
      skinUrl: String(row.skinUrl || '').trim(),
      leagueSlug: String(row.leagueSlug || '').trim().toLowerCase(),
      carNumber: String(row.carNumber || '').trim(),
    }))
    .filter((row) => row.skinUrl && row.leagueSlug)
}

export function TeamSkinConfigEditor({
  leagues,
  initialProfiles,
}: {
  leagues: LeagueOption[]
  initialProfiles: SkinProfile[]
}) {
  const [profiles, setProfiles] = useState<SkinProfile[]>(() => {
    if (initialProfiles && initialProfiles.length > 0) {
      return initialProfiles.map((p: any) => ({
        skinUrl: p.skinUrl || '',
        leagueSlug: p.leagueSlug || leagues[0]?.slug || '',
        carNumber: p.carNumber || p.label || ''
      }))
    }
    return [{ skinUrl: '', leagueSlug: leagues[0]?.slug || '', carNumber: '' }]
  })

  const serialized = useMemo(() => JSON.stringify(normalizeProfiles(profiles)), [profiles])

  return (
    <div className="space-y-3">
      <input type="hidden" name="skinProfilesJson" value={serialized} />
      
      {profiles.map((profile, index) => (
        <div key={`skin-row-${index}`} className="grid gap-2 border border-shell-line bg-black/20 p-2 md:grid-cols-[180px_minmax(0,1fr)_220px_90px] rounded-lg">
          {/* Coche / Piloto */}
          <input
            value={profile.carNumber}
            onChange={(event) =>
              setProfiles((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, carNumber: event.target.value } : row)))
            }
            placeholder="Coche / Piloto (Ej: GT3 #24)"
            className="border border-shell-line bg-black/20 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400"
          />

          {/* Skin URL */}
          <input
            value={profile.skinUrl}
            onChange={(event) =>
              setProfiles((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, skinUrl: event.target.value } : row)))
            }
            placeholder="URL de Descarga de Skin"
            className="border border-shell-line bg-black/20 px-3 py-2 text-xs text-white outline-none rounded-lg focus:border-cyan-400"
          />

          {/* League Dropdown (only created leagues) */}
          <select
            value={profile.leagueSlug}
            onChange={(event) =>
              setProfiles((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, leagueSlug: event.target.value } : row)))
            }
            className="border border-shell-line bg-black/20 px-3 py-2 text-xs text-white outline-none rounded-lg cursor-pointer focus:border-cyan-400"
          >
            {leagues.map((league) => (
              <option key={league.slug} value={league.slug}>
                {league.title}
              </option>
            ))}
          </select>

          {/* Remove Button */}
          <button
            type="button"
            onClick={() => setProfiles((prev) => (prev.length <= 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)))}
            className="border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-350 rounded-lg cursor-pointer transition-colors"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setProfiles((prev) => [...prev, { skinUrl: '', leagueSlug: leagues[0]?.slug || '', carNumber: '' }])}
        className="border border-shell-line bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-lg cursor-pointer transition-colors"
      >
        Add skin
      </button>
    </div>
  )
}

