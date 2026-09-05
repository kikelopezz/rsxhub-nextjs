'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { updateCarPhotoAction } from '@/app/ligas/actions'

export type League = {
  id: string
  title: string
  slug: string
  simulator: string
  format: string
  classTags?: string[]
  startsAt: string
  endsAt: string
  registrationOpen: boolean
  fullDescription: string
  status: string
  bannerUrl: string | null
  accentColor?: string | null
  slogan?: string | null
  discordUrl?: string | null
  youtubeUrl?: string | null
  rulebookUrl?: string | null
}

export type LeagueEvent = {
  id: string
  leagueId: string
  circuitId: string | null
  title: string | null
  circuitName: string
  circuitImageUrl: string | null
  serverLink?: string | null
  hasQualy?: boolean
  qualyStartsAt?: string | null
  qualyEndsAt?: string | null
  startsAt: string
  endsAt: string
  eventType?: string
  countryCode?: string | null
  color?: string | null
  qualyCompleted?: boolean
  completedAt?: string | null
  maxDrivers?: number | null
  classLimits?: Record<string, number> | null
}

export type Registration = {
  id: string
  leagueId: string
  userId: string
  teamId: string | null
  displayName: string
  steamId?: string
  classTag: string | null
  assignedNumber: number | string | null
  status: string
}

export type ManagedTeam = {
  id: string
  name: string
  logoUrl: string | null
  status?: string
  cars?: any[]
  members: Array<{ userId: string; displayName: string; steamId?: string }>
}

export type LeagueCar = {
  id: string
  label: string
  model: string
}

export type EventConfirmation = {
  id: string
  eventId: string
  leagueId: string
  teamId: string
  classTag: string
  carNumber: number | string
  status: string
  driverUserIds?: string[]
}

export type TeamStanding = {
  id: string
  teamId?: string
  name: string
  points: number
  logoUrl: string
  drivers: string
  assignedNumber?: number | string | null
  carImageUrl?: string | null
}

export function useLeagueState({
  league,
  initialEvents,
  initialRegistrations,
  myManagedTeams,
  teamInfo = {},
  initialConfirmations = [],
  initialPointsOverrides = {},
  initialCarPhotos = {}
}: {
  league: League
  initialEvents: LeagueEvent[]
  initialRegistrations: Registration[]
  myManagedTeams: ManagedTeam[]
  teamInfo?: Record<string, { name: string; primaryColor: string | null; logoUrl: string | null }>
  initialConfirmations?: EventConfirmation[]
  initialPointsOverrides?: Record<string, number>
  initialCarPhotos?: Record<string, string>
}) {
  const router = useRouter()
  const [events, setEvents] = useState<LeagueEvent[]>(initialEvents)
  const [confirmations, setConfirmations] = useState<EventConfirmation[]>(initialConfirmations)

  useEffect(() => {
    setConfirmations(initialConfirmations)
  }, [initialConfirmations])

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  // Periodic background auto-refresh to synchronize multi-browser / multi-user attendance & standings live
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh()
    }, 5000)
    return () => clearInterval(timer)
  }, [router])

  const classTags = useMemo(
    () => (league.classTags && league.classTags.length > 0 ? league.classTags : ['GT3']),
    [league.classTags]
  )

  const [standings, setStandings] = useState<Record<string, TeamStanding[]>>({})
  const [standingsIndices, setStandingsIndices] = useState<Record<string, number>>({})

  useEffect(() => {
    const initialStandings: Record<string, TeamStanding[]> = {}
    const initialIndices: Record<string, number> = {}

    classTags.forEach((tag) => {
      const uniqueKeys = new Set<string>()
      const list: TeamStanding[] = []

      initialRegistrations.forEach((reg) => {
        if (reg.classTag === tag && reg.teamId && reg.status !== 'rejected') {
          const teamDetails = teamInfo[reg.teamId] || myManagedTeams.find((t) => t.id === reg.teamId) || {
            name: reg.displayName,
            logoUrl: `https://placehold.co/40x40/0a1220/ffffff?text=${reg.displayName.slice(0, 3).toUpperCase()}`
          }

          const dorsal = reg.assignedNumber != null ? String(reg.assignedNumber) : null
          const uniqueKey = `${reg.teamId}_${dorsal != null ? dorsal : ''}`

          if (!uniqueKeys.has(uniqueKey)) {
            uniqueKeys.add(uniqueKey)
            const teamName = teamDetails.name
            const logoUrl = teamDetails.logoUrl || `https://placehold.co/40x40/0a1220/ffffff?text=${teamName.slice(0, 3).toUpperCase()}`
            const carImageUrl = (teamDetails as any).carImageUrl || (teamDetails as any).lateralImageUrl || '/branding/lateral-car.png'
            // Points belong to this specific car (dorsal), not the team as a whole — a team
            // with two cars in the same class must score them independently.
            const savedPoints = initialPointsOverrides?.[`${tag}_${reg.teamId}_${dorsal != null ? dorsal : ''}`] ?? 0

            list.push({
              id: uniqueKey,
              teamId: reg.teamId,
              name: teamName,
              points: savedPoints,
              logoUrl,
              drivers: '',
              assignedNumber: dorsal,
              carImageUrl,
            })
          }
        }
      })

      // Sort descending by points so positions order dynamically
      list.sort((a, b) => b.points - a.points)

      initialIndices[tag] = 0
      initialStandings[tag] = list
    })
    setStandings(initialStandings)
    setStandingsIndices(initialIndices)
  }, [initialRegistrations, classTags, myManagedTeams, teamInfo, initialPointsOverrides])

  // Custom car images per car (`${classTag}_${teamId}_${carNumber}`, matching the
  // TeamStanding row id) — seeded from the server (LeagueCarPhoto, persisted per league)
  // so every viewer sees the same photo, not just whoever uploaded it in their own browser.
  const [customCarImages, setCustomCarImages] = useState<Record<string, string>>(initialCarPhotos)

  useEffect(() => {
    setCustomCarImages(initialCarPhotos)
  }, [initialCarPhotos])

  const handleCarImageUpload = async (tag: string, teamId: string, carNumber: string, file: File) => {
    const carKey = `${tag}_${teamId}_${carNumber}`

    // Instant local preview via a data URL while the real upload is in flight, so the
    // admin doesn't stare at the old photo during the round-trip.
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        setCustomCarImages((prev) => ({ ...prev, [carKey]: result }))
      }
    }
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'car')
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setCustomCarImages((prev) => ({ ...prev, [carKey]: data.url }))

          const photoForm = new FormData()
          photoForm.set('leagueId', league.id)
          photoForm.set('classTag', tag)
          photoForm.set('teamId', teamId)
          photoForm.set('carNumber', carNumber)
          photoForm.set('imageUrl', data.url)
          photoForm.set('slug', league.slug)
          await updateCarPhotoAction(photoForm)
          router.refresh()
        }
      }
    } catch (err) {
      console.error('Failed to upload car image:', err)
    }
  }

  // Scroll standings
  const scrollStandings = (tag: string, direction: 'up' | 'down') => {
    setStandingsIndices((prev) => {
      const current = prev[tag] || 0
      const total = (standings[tag] || []).length
      if (direction === 'up') {
        return { ...prev, [tag]: Math.max(0, current - 5) }
      } else {
        return { ...prev, [tag]: Math.min(Math.max(0, total - 5), current + 5) }
      }
    })
  }

  // Track registrations grouped by team & category across all teams in league
  const allRegisteredCars = useMemo(
    () => initialRegistrations.filter((r) => r.teamId && r.status !== 'rejected'),
    [initialRegistrations]
  )

  const uniqueRegisteredCars = useMemo(
    () =>
      Array.from(
        allRegisteredCars.reduce((acc, r) => {
          const key = `${r.teamId}_${r.classTag}_${r.assignedNumber}`
          if (!acc.has(key)) acc.set(key, r)
          return acc
        }, new Map<string, Registration>()).values()
      ),
    [allRegisteredCars]
  )

  const groupedRegistrations = useMemo(() => {
    const map = new Map<
      string,
      { teamId: string; teamName: string; logoUrl: string | null; categories: Array<{ tag: string; status: string }> }
    >()

    uniqueRegisteredCars.forEach((car) => {
      if (!car.teamId) return
      const teamName =
        teamInfo[car.teamId]?.name ||
        myManagedTeams.find((t) => t.id === car.teamId)?.name ||
        car.displayName ||
        'Team'
      const logoUrl =
        teamInfo[car.teamId]?.logoUrl ||
        myManagedTeams.find((t) => t.id === car.teamId)?.logoUrl ||
        null
      const tag = car.classTag || 'GENERAL'
      if (!map.has(car.teamId)) {
        map.set(car.teamId, { teamId: car.teamId, teamName, logoUrl, categories: [] })
      }
      const teamRecord = map.get(car.teamId)!
      const existing = teamRecord.categories.find((c) => c.tag === tag)
      if (!existing) {
        teamRecord.categories.push({ tag, status: car.status || 'pending' })
      }
    })

    return Array.from(map.values())
  }, [uniqueRegisteredCars, myManagedTeams, teamInfo])

  // `rowId` is the standing row's own unique id (`${teamId}_${carNumber}`) — matching on
  // that instead of just teamId is what keeps two cars from the same team in the same
  // class from overwriting each other's points.
  const updateTeamPoints = (tag: string, rowId: string, newPoints: number) => {
    setStandings((prev) => {
      const list = [...(prev[tag] || [])]
      const idx = list.findIndex((t) => t.id === rowId)
      if (idx !== -1) {
        list[idx] = { ...list[idx], points: newPoints }
        list.sort((a, b) => b.points - a.points)
      }
      return { ...prev, [tag]: list }
    })
  }

  return {
    events,
    setEvents,
    confirmations,
    setConfirmations,
    classTags,
    standings,
    standingsIndices,
    customCarImages,
    handleCarImageUpload,
    scrollStandings,
    updateTeamPoints,
    registeredCars: allRegisteredCars,
    uniqueRegisteredCars,
    groupedRegistrations
  }
}
