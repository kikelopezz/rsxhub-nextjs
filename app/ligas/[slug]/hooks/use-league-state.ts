'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

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
  initialPointsOverrides = {}
}: {
  league: League
  initialEvents: LeagueEvent[]
  initialRegistrations: Registration[]
  myManagedTeams: ManagedTeam[]
  teamInfo?: Record<string, { name: string; primaryColor: string | null; logoUrl: string | null }>
  initialConfirmations?: EventConfirmation[]
  initialPointsOverrides?: Record<string, number>
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
            const savedPoints = initialPointsOverrides?.[`${tag}_${reg.teamId}`] ?? 0

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

  // Custom car images per team
  const [customCarImages, setCustomCarImages] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem('team_car_images')
      if (saved) {
        setCustomCarImages(JSON.parse(saved))
      }
    } catch (e) {}
  }, [])

  const handleCarImageUpload = async (teamId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) {
        setCustomCarImages((prev) => {
          const next = { ...prev, [teamId]: result }
          try {
            const saved = JSON.parse(localStorage.getItem('team_car_images') || '{}')
            saved[teamId] = result
            localStorage.setItem('team_car_images', JSON.stringify(saved))
          } catch (err) {}
          return next
        })
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
          setCustomCarImages((prev) => {
            const next = { ...prev, [teamId]: data.url }
            try {
              const saved = JSON.parse(localStorage.getItem('team_car_images') || '{}')
              saved[teamId] = data.url
              localStorage.setItem('team_car_images', JSON.stringify(saved))
            } catch (err) {}
            return next
          })
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

  const updateTeamPoints = (tag: string, teamId: string, newPoints: number) => {
    setStandings((prev) => {
      const list = [...(prev[tag] || [])]
      const idx = list.findIndex((t) => t.teamId === teamId || t.id === teamId || t.id.startsWith(teamId))
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
