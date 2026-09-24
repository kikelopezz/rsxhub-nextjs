import type { ManagedTeam, Registration, EventConfirmation } from '../hooks/use-league-state'

// ─── resolveTeamName ─────────────────────────────────────────────────────────

export function resolveTeamName(
  teamId: string,
  myManagedTeams: ManagedTeam[],
  allTeamsInStandings: Array<{ id: string; name: string }>,
  teamInfo: Record<string, { name: string }>,
): string {
  const managed = myManagedTeams.find((t) => t.id === teamId)
  if (managed) return managed.name
  const standingTeam = allTeamsInStandings.find((t) => t.id === teamId)
  if (standingTeam) return standingTeam.name
  const info = teamInfo[teamId]
  if (info) return info.name
  return `Team (${teamId.slice(0, 5)})`
}

// ─── resolveCarSkin ───────────────────────────────────────────────────────────

type TeamInfoEntry = { name: string; primaryColor: string | null; logoUrl: string | null; cars?: any[]; members?: any[]; skinAssignments?: any[] }

export function resolveCarSkin(
  teamId: string,
  classTag: string,
  dorsal: string,
  myManagedTeams: ManagedTeam[],
  teamInfo: Record<string, TeamInfoEntry>,
): string | null {
  const targetDorsal = String(dorsal ?? '').trim()
  const targetTag = String(classTag ?? '').trim().toUpperCase()

  const checkCars = (cars?: any[]): { found: boolean; url: string | null } => {
    if (!Array.isArray(cars) || cars.length === 0) return { found: false, url: null }
    const car1 = cars.find(
      (c: any) =>
        String(c.category || '').toUpperCase() === targetTag &&
        String(c.dorsal ?? '').trim() === targetDorsal,
    )
    if (car1) {
      const url = String(car1.skinUrl || car1.skin_url || car1.skin || car1.skinFile || '').trim()
      return { found: true, url: url || null }
    }
    const car2 = cars.find((c: any) => String(c.dorsal ?? '').trim() === targetDorsal)
    if (car2) {
      const url = String(car2.skinUrl || car2.skin_url || car2.skin || car2.skinFile || '').trim()
      return { found: true, url: url || null }
    }
    return { found: false, url: null }
  }

  const checkAssignments = (assignments?: any[]): { found: boolean; url: string | null } => {
    if (!Array.isArray(assignments) || assignments.length === 0) return { found: false, url: null }
    const match = assignments.find(
      (s: any) => String((s.carNumber || s.dorsal) ?? '').trim() === targetDorsal,
    )
    if (match) {
      const url = String(match.skinUrl || match.skin_url || '').trim()
      return { found: true, url: url || null }
    }
    return { found: false, url: null }
  }

  const managed = myManagedTeams.find((m) => m.id === teamId)
  if (managed) {
    const resCars = checkCars(managed.cars)
    if (resCars.found) return resCars.url
    const resAss = checkAssignments((managed as any).skinAssignments)
    if (resAss.found) return resAss.url
  }

  const info = teamInfo[teamId]
  if (info) {
    const resCars = checkCars(info.cars)
    if (resCars.found) return resCars.url
    const resAss = checkAssignments(info.skinAssignments)
    if (resAss.found) return resAss.url
  }

  return null
}

// ─── resolveCarModelFolder ───────────────────────────────────────────────────

export function resolveCarModelFolder(
  teamId: string,
  classTag: string,
  dorsal: string,
  myManagedTeams: ManagedTeam[],
  teamInfo: Record<string, TeamInfoEntry>,
): string | null {
  const targetDorsal = String(dorsal ?? '').trim()
  const targetTag = String(classTag ?? '').trim().toUpperCase()

  const checkCars = (cars?: any[]) => {
    if (!Array.isArray(cars) || cars.length === 0) return null
    const car1 = cars.find(
      (c: any) =>
        String(c.category || '').toUpperCase() === targetTag &&
        String(c.dorsal ?? '').trim() === targetDorsal,
    )
    if (car1) return car1.modelFolder || car1.model_folder || car1.ac_folder || null
    const car2 = cars.find((c: any) => String(c.dorsal ?? '').trim() === targetDorsal)
    if (car2) return car2.modelFolder || car2.model_folder || car2.ac_folder || null
    return null
  }

  const managed = myManagedTeams.find((m) => m.id === teamId)
  if (managed) {
    const res = checkCars(managed.cars)
    if (res) return res
  }

  const info = teamInfo[teamId]
  if (info) {
    const res = checkCars(info.cars)
    if (res) return res
  }

  return null
}

// ─── getSteam64Id ─────────────────────────────────────────────────────────────

export function getSteam64Id(...candidates: any[]): string {
  // 0. Explicit check for MunCato account / admin steam ID
  for (const cand of candidates) {
    if (!cand) continue
    const str =
      typeof cand === 'object'
        ? String(cand.displayName || cand.name || cand.steamDisplayName || cand.email || cand.userId || cand.user_id || cand.id || '').toLowerCase()
        : String(cand).toLowerCase()
    if (str.includes('muncato')) {
      return '76561198341588341'
    }
  }

  // 1. Check for real 15-18 digit numeric Steam ID in candidate objects/strings
  for (const cand of candidates) {
    if (!cand) continue
    if (typeof cand === 'object') {
      const keys = [
        cand.steamId,
        cand.steam_id,
        cand.steamId64,
        cand.steam_id64,
        cand.id64,
        cand.steam_account?.steam_id,
        cand.steamAccount?.steamId,
        cand.steam_account?.steamId,
        cand.userId,
        cand.user_id,
        cand.id,
      ]
      for (const k of keys) {
        if (!k) continue
        const cleaned = String(k).trim().replace(/^steam_/, '')
        if (/^\d{15,18}$/.test(cleaned)) return cleaned
      }
      continue
    }
    const cleaned = String(cand).trim().replace(/^steam_/, '')
    if (/^\d{15,18}$/.test(cleaned)) return cleaned
  }

  // 2. Deterministic fallback: Generate valid 17-digit Steam 64 ID (7656119...) based on candidate string seed
  for (const cand of candidates) {
    if (!cand) continue
    const seedStr =
      typeof cand === 'object'
        ? String(cand.userId || cand.user_id || cand.displayName || cand.name || cand.email || cand.id || '')
        : String(cand)

    if (seedStr && seedStr.trim()) {
      const cleaned = seedStr.trim().replace(/^steam_/, '')
      if (/^\d{15,18}$/.test(cleaned)) return cleaned

      const sum = Array.from(cleaned).reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const numericPart = 1000000000 + (sum * 1234567) % 9000000000
      return `7656119${numericPart}`
    }
  }

  return '76561198000000000'
}

// ─── resolveDrivers ───────────────────────────────────────────────────────────

export function resolveDrivers(
  teamId: string,
  classTag: string,
  carNumber: string | number,
  eventLeagueId: string | undefined,
  myManagedTeams: ManagedTeam[],
  teamInfo: Record<string, TeamInfoEntry>,
  registrations: Registration[],
): Array<{ name: string; steamId: string; userId?: string }> {
  const targetDorsal = String(carNumber ?? '').trim()
  const targetTag = String(classTag ?? '').trim().toUpperCase()

  const managed = myManagedTeams.find((t) => t.id === teamId)
  const info = teamInfo[teamId]
  const teamCars = managed?.cars || info?.cars || []
  const teamMembers: any[] = managed?.members || info?.members || []

  const car =
    teamCars.find(
      (c: any) =>
        String(c.category || '').toUpperCase() === targetTag &&
        String(c.dorsal ?? '').trim() === targetDorsal,
    ) || teamCars.find((c: any) => String(c.dorsal ?? '').trim() === targetDorsal)

  const byLeague = car?.driverUserIdsByLeague || car?.driver_user_ids_by_league || {}
  let driverUserIds: string[] = []
  if (eventLeagueId && byLeague[eventLeagueId] && Array.isArray(byLeague[eventLeagueId]) && byLeague[eventLeagueId].length > 0) {
    driverUserIds = byLeague[eventLeagueId].filter(Boolean).map(String)
  } else if (Array.isArray(car?.driverUserIds) && car.driverUserIds.length > 0) {
    driverUserIds = car.driverUserIds.filter(Boolean).map(String)
  } else if (Array.isArray(car?.driver_user_ids) && car.driver_user_ids.length > 0) {
    driverUserIds = car.driver_user_ids.filter(Boolean).map(String)
  }

  if (driverUserIds.length > 0) {
    const resolved = driverUserIds
      .map((dId) => {
        const member = teamMembers.find(
          (m: any) =>
            m.userId === dId ||
            m.user_id === dId ||
            m.id === dId ||
            m.steamId === dId ||
            m.steam_id === dId ||
            (m.displayName && String(m.displayName).trim().toLowerCase() === String(dId).trim().toLowerCase()) ||
            (m.name && String(m.name).trim().toLowerCase() === String(dId).trim().toLowerCase())
        )
        const reg =
          registrations.find(
            (r) =>
              (r.userId === dId || (r.displayName && String(r.displayName).trim().toLowerCase() === String(dId).trim().toLowerCase())) &&
              (r.teamId === teamId || !r.teamId)
          ) ||
          registrations.find(
            (r) =>
              r.userId === dId || (r.displayName && String(r.displayName).trim().toLowerCase() === String(dId).trim().toLowerCase())
          )

        const name =
          member?.displayName || member?.name || member?.steamDisplayName ||
          reg?.displayName || (dId.toLowerCase().includes('muncato') ? 'MunCato' : `Driver (${dId.slice(0, 6)})`)

        let steamId = getSteam64Id(member, reg, dId, name)

        // Resilient fallback lookup if steamId was not found:
        if (!steamId || steamId.includes('2980245468')) {
          const fallbackReg = registrations.find((r) => r.userId === dId || (r as any).user_id === dId || r.steamId === dId)
          if (fallbackReg) steamId = getSteam64Id(fallbackReg)
        }
        if (!steamId || steamId.includes('2980245468')) {
          if (myManagedTeams) {
            for (const mTeam of myManagedTeams) {
              const mMatch = (mTeam.members || []).find((m: any) => m.userId === dId || m.user_id === dId || (m.displayName && String(m.displayName).toLowerCase() === String(dId).toLowerCase()))
              if (mMatch) {
                const s = getSteam64Id(mMatch)
                if (s) { steamId = s; break }
              }
            }
          }
        }
        if (!steamId || steamId.includes('2980245468')) {
          if (teamInfo) {
            for (const infoKey of Object.keys(teamInfo)) {
              const tInf = teamInfo[infoKey]
              const mMatch = (tInf.members || []).find((m: any) => m.userId === dId || m.user_id === dId || (m.displayName && String(m.displayName).toLowerCase() === String(dId).toLowerCase()))
              if (mMatch) {
                const s = getSteam64Id(mMatch)
                if (s) { steamId = s; break }
              }
            }
          }
        }

        const resolvedUserId = member?.userId || member?.user_id || reg?.userId || undefined
        return { name, steamId, userId: resolvedUserId }
      })
      .filter((d) => d.name)
    if (resolved.length > 0) return resolved
  }

  const matchedRegs = registrations.filter(
    (r) =>
      r.teamId === teamId &&
      String(r.classTag || '').toUpperCase() === targetTag &&
      (String(r.assignedNumber ?? '').trim() === targetDorsal || !targetDorsal),
  )
  if (matchedRegs.length > 0) {
    return matchedRegs.map((r) => {
      const member = teamMembers.find((m: any) => m.userId === r.userId || m.user_id === r.userId)
      return {
        name: r.displayName || member?.displayName || member?.name || 'Driver',
        steamId: getSteam64Id(member, r, r.userId),
        userId: r.userId,
      }
    })
  }

  if (teamMembers.length > 0) {
    return teamMembers.map((m: any) => ({
      name: m.displayName || m.name || m.steamDisplayName || 'Driver',
      steamId: getSteam64Id(m, m.userId),
      userId: m.userId,
    }))
  }

  return []
}

// ─── buildCategorySkinZip ─────────────────────────────────────────────────────

import JSZip from 'jszip'

export async function buildCategorySkinZip(
  tag: string,
  teamList: Array<{ teamId: string; teamName: string; dorsal: string }>,
  myManagedTeams: ManagedTeam[],
  teamInfo: Record<string, TeamInfoEntry>,
): Promise<{ blob: Blob; count: number }> {
  const masterZip = new JSZip()
  let downloadedCount = 0

  for (const t of teamList) {
    const skinUrl = resolveCarSkin(t.teamId, tag, t.dorsal, myManagedTeams, teamInfo)
    const acFolder = resolveCarModelFolder(t.teamId, tag, t.dorsal, myManagedTeams, teamInfo)

    if (skinUrl) {
      const sanitize = (str: string) => str.replace(/[^a-z0-9_-]/gi, '_')
      const skinFolderName = `#${t.dorsal}_${sanitize(t.teamName)}`

      try {
        let buffer: ArrayBuffer | null = null

        if (skinUrl.startsWith('data:')) {
          const base64Parts = skinUrl.split(',')
          if (base64Parts[1]) {
            const binaryStr = atob(base64Parts[1])
            const len = binaryStr.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i)
            buffer = bytes.buffer
          }
        } else if (skinUrl.startsWith('http') || skinUrl.startsWith('/')) {
          const resp = await fetch(skinUrl)
          if (resp.ok) {
            buffer = await resp.arrayBuffer()
          } else {
            console.warn(`Fetch returned status ${resp.status} for skinUrl: ${skinUrl}`)
          }
        }

        if (buffer) {
          try {
            const teamZip = await JSZip.loadAsync(buffer)
            let hasContentCars = false
            let hasSkinsFolder = false
            teamZip.forEach((relativePath) => {
              if (relativePath.startsWith('content/cars/')) hasContentCars = true
              if (relativePath.startsWith('skins/')) hasSkinsFolder = true
            })

            for (const [relativePath, zipObj] of Object.entries(teamZip.files)) {
              if (zipObj.dir) continue
              const fileData = await zipObj.async('uint8array')
              if (hasContentCars) {
                masterZip.file(relativePath, fileData)
              } else if (hasSkinsFolder) {
                if (acFolder) {
                  masterZip.file(`content/cars/${acFolder}/${relativePath}`, fileData)
                } else {
                  masterZip.file(relativePath, fileData)
                }
              } else {
                if (acFolder) {
                  masterZip.file(`content/cars/${acFolder}/skins/${skinFolderName}/${relativePath}`, fileData)
                } else {
                  masterZip.file(`content/cars/${tag.toLowerCase()}/skins/${skinFolderName}/${relativePath}`, fileData)
                }
              }
            }
            downloadedCount++
          } catch {
            const ext = skinUrl.includes('.') ? skinUrl.slice(skinUrl.lastIndexOf('.')) : '.dds'
            if (acFolder) {
              masterZip.file(`content/cars/${acFolder}/skins/${skinFolderName}/skin${ext}`, new Uint8Array(buffer))
            } else {
              masterZip.file(`content/cars/${tag.toLowerCase()}/skins/${skinFolderName}/skin${ext}`, new Uint8Array(buffer))
            }
            downloadedCount++
          }
        }
      } catch (fetchErr) {
        console.error(`Failed to fetch/process skin for team ${t.teamName}:`, fetchErr)
      }
    }
  }

  const blob = await masterZip.generateAsync({ type: 'blob' })
  return { blob, count: downloadedCount }
}
