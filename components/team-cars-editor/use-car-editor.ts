'use client'

import { useState, useMemo, useCallback } from 'react'
import type { CarEntry, LeagueOption, TakenDorsal } from './types'
import { MAX_DRIVERS_PER_CAR, MAX_RESERVE_DRIVERS_PER_CAR } from './types'
import { computeCarValidation } from './car-validation'
import { uploadSkinFile } from './car-skin-upload'
import { useDictionary } from '@/lib/i18n/locale-provider'

const CATEGORIES: Array<'GT3' | 'LMP2' | 'HYPERCAR'> = ['GT3', 'LMP2', 'HYPERCAR']
export { CATEGORIES }

export type UseCarEditorOptions = {
  initialCars: CarEntry[]
  leaguesOptions: LeagueOption[]
  takenDorsals: TakenDorsal[]
  currentTeamId: string
}

export function useCarEditor({
  initialCars,
  leaguesOptions,
  takenDorsals,
  currentTeamId,
}: UseCarEditorOptions) {
  const carEditorDict = useDictionary().equipos.carEditor
  const [cars, setCars] = useState<CarEntry[]>(() => {
    if (initialCars && initialCars.length > 0) {
      return initialCars.map((car) => {
        const byLeague: Record<string, string[]> =
          car.driverUserIdsByLeague || (car as any).driver_user_ids_by_league || {}
        const reserveByLeague: Record<string, string[]> =
          car.reserveDriverUserIdsByLeague || (car as any).reserve_driver_user_ids_by_league || {}
        const rawLeagueId = car.leagueId || (car as any).league_id || null
        const matchedLeague = leaguesOptions.find((l) => l.id === rawLeagueId || l.slug === rawLeagueId)
        const carLeagueId = matchedLeague ? matchedLeague.id : rawLeagueId

        if (Object.keys(byLeague).length === 0 && Array.isArray(car.driverUserIds)) {
          if (carLeagueId) byLeague[carLeagueId] = [...car.driverUserIds]
        }
        if (Object.keys(reserveByLeague).length === 0 && Array.isArray(car.reserveDriverUserIds)) {
          if (carLeagueId) reserveByLeague[carLeagueId] = [...car.reserveDriverUserIds]
        }
        return {
          id: car.id || ('car_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
          category: car.category || 'GT3',
          dorsal: String(car.dorsal || '').trim(),
          modelName: car.modelName || (car as any).model_name || (car as any).model || '',
          modelFolder: car.modelFolder || (car as any).model_folder || (car as any).ac_folder || '',
          skinUrl: car.skinUrl || (car as any).skin_url || '',
          skinName: car.skinName || (car as any).skin_name || '',
          driverUserIds: Array.isArray(car.driverUserIds) ? car.driverUserIds.filter(Boolean) : [],
          driverUserIdsByLeague: byLeague,
          reserveDriverUserIds: Array.isArray(car.reserveDriverUserIds) ? car.reserveDriverUserIds.filter(Boolean) : [],
          reserveDriverUserIdsByLeague: reserveByLeague,
          leagueId: carLeagueId,
        }
      })
    }
    return []
  })

  const [activeTab, setActiveTab] = useState<string>('all')
  const [uploadingCarId, setUploadingCarId] = useState<string | null>(null)

  const activeLeague = useMemo(
    () => leaguesOptions.find((l) => l.id === activeTab || l.slug === activeTab),
    [leaguesOptions, activeTab],
  )

  const getCarDriversForLeague = useCallback(
    (car: CarEntry, leagueKey: string): string[] => {
      if (!leagueKey || leagueKey === 'all') return car.driverUserIds || []
      const byLeague = car.driverUserIdsByLeague || {}
      const list =
        byLeague[leagueKey] ||
        byLeague[activeLeague?.id || ''] ||
        byLeague[activeLeague?.slug || ''] ||
        []
      return [...list, '', '', '', ''].slice(0, MAX_DRIVERS_PER_CAR)
    },
    [activeLeague],
  )

  const getCarReserveDriversForLeague = useCallback(
    (car: CarEntry, leagueKey: string): string[] => {
      if (!leagueKey || leagueKey === 'all') return car.reserveDriverUserIds || []
      const byLeague = car.reserveDriverUserIdsByLeague || {}
      const list =
        byLeague[leagueKey] ||
        byLeague[activeLeague?.id || ''] ||
        byLeague[activeLeague?.slug || ''] ||
        []
      return [...list, ...Array(MAX_RESERVE_DRIVERS_PER_CAR).fill('')].slice(0, MAX_RESERVE_DRIVERS_PER_CAR)
    },
    [activeLeague],
  )

  // "Taken" only means something relative to a specific league: a driver already
  // driving a GT3 car in Endurance is fair game to also drive a GT3 car in ERC Next
  // Gen — they're different championships. So a car's drivers can only make another
  // car's slot look "taken" when both cars actually belong to the *same* league;
  // this used to compare every car against a single global set of active drivers,
  // which meant a driver already used in league A appeared unavailable while
  // building a car for league B too.
  const getAssignedDriverIdsForLeague = useCallback(
    (leagueKey: string) => {
      const set = new Set<string>()
      for (const car of cars) {
        const carLeagueKey = car.leagueId || 'general'
        if (carLeagueKey !== leagueKey) continue
        for (const driverId of getCarDriversForLeague(car, leagueKey)) {
          if (driverId && driverId.trim()) set.add(driverId.trim())
        }
      }
      return set
    },
    [cars, getCarDriversForLeague],
  )

  const carValidation = useMemo(
    () => computeCarValidation(cars, takenDorsals, currentTeamId, carEditorDict),
    [cars, takenDorsals, currentTeamId, carEditorDict],
  )

  const hasErrors = Object.keys(carValidation).length > 0

  const serialized = useMemo(() => {
    const cleaned = cars.map((car) => ({
      id: car.id,
      category: car.category,
      dorsal: String(car.dorsal || '').trim(),
      modelName: String(car.modelName || '').trim(),
      modelFolder: String(car.modelFolder || '').trim(),
      skinUrl: String(car.skinUrl || '').trim(),
      skinName: String(car.skinName || '').trim(),
      driverUserIds: (car.driverUserIds || []).map((id) => String(id || '').trim()).filter(Boolean),
      driverUserIdsByLeague: car.driverUserIdsByLeague || {},
      reserveDriverUserIds: (car.reserveDriverUserIds || []).map((id) => String(id || '').trim()).filter(Boolean),
      reserveDriverUserIdsByLeague: car.reserveDriverUserIdsByLeague || {},
      leagueId: car.leagueId || null,
    }))
    return JSON.stringify(cleaned)
  }, [cars])

  const addCar = (category: 'GT3' | 'LMP2' | 'HYPERCAR', defaultLeagueId?: string | null) => {
    setCars((prev) => [
      ...prev,
      {
        id: 'car_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        category,
        dorsal: '',
        modelName: '',
        modelFolder: '',
        skinUrl: '',
        driverUserIds: [],
        driverUserIdsByLeague: {},
        reserveDriverUserIds: [],
        reserveDriverUserIdsByLeague: {},
        leagueId: defaultLeagueId || (activeTab === 'all' ? (leaguesOptions[0]?.id || null) : activeTab),
      },
    ])
  }

  const removeCar = (id: string) => {
    setCars((prev) => prev.filter((car) => car.id !== id))
  }

  const updateCarField = (id: string, field: keyof CarEntry, value: any) => {
    setCars((prev) => prev.map((car) => (car.id === id ? { ...car, [field]: value } : car)))
  }

  const leaguesOverlapFn = (l1?: string | null, l2?: string | null) => {
    if (!l1 || !l2) return true
    return l1 === l2
  }

  const updateCarDriver = (id: string, leagueKey: string, driverIndex: number, userId: string) => {
    const cleanUserId = userId ? userId.trim() : ''
    setCars((prev) => {
      const targetCar = prev.find((c) => c.id === id)
      if (!targetCar) return prev

      const targetLeagueKey =
        leagueKey && leagueKey !== 'all' ? leagueKey : targetCar.leagueId || 'general'
      const maxSlots = MAX_DRIVERS_PER_CAR

      return prev.map((car) => {
        const currentByLeague = { ...(car.driverUserIdsByLeague || {}) }

        if (car.id === id) {
          const currentList = [...(currentByLeague[targetLeagueKey] || [])]
          while (currentList.length < maxSlots) currentList.push('')
          currentList[driverIndex] = cleanUserId
          currentByLeague[targetLeagueKey] = currentList
          const carLeagueKey = car.leagueId || targetLeagueKey
          const primaryDriverList = currentByLeague[carLeagueKey] || currentList
          return {
            ...car,
            driverUserIdsByLeague: currentByLeague,
            driverUserIds: primaryDriverList.map((d) => String(d || '').trim()),
          }
        }

        if (cleanUserId) {
          const carLeague = car.leagueId || 'general'
          if (leaguesOverlapFn(carLeague, targetLeagueKey)) {
            let changed = false
            Object.keys(currentByLeague).forEach((lKey) => {
              if (leaguesOverlapFn(lKey, targetLeagueKey)) {
                const arr = [...(currentByLeague[lKey] || [])]
                const newArr = arr.map((d) => (d === cleanUserId ? '' : d))
                if (JSON.stringify(arr) !== JSON.stringify(newArr)) {
                  currentByLeague[lKey] = newArr
                  changed = true
                }
              }
            })
            if (changed) {
              const carLeagueKey = car.leagueId || 'general'
              const primaryDriverList = currentByLeague[carLeagueKey] || []
              return {
                ...car,
                driverUserIdsByLeague: currentByLeague,
                driverUserIds: primaryDriverList.map((d) => String(d || '').trim()),
              }
            }
          }
        }
        return car
      })
    })
  }

  // Simpler than updateCarDriver on purpose: a reserve isn't exclusive to one car the way a
  // regular driver slot is (the same person can be the reserve for more than one car), so
  // there's no need to clear them out of other cars' reserve slots when assigned here.
  const updateCarReserveDriver = (id: string, leagueKey: string, driverIndex: number, userId: string) => {
    const cleanUserId = userId ? userId.trim() : ''
    setCars((prev) =>
      prev.map((car) => {
        if (car.id !== id) return car
        const targetLeagueKey = leagueKey && leagueKey !== 'all' ? leagueKey : car.leagueId || 'general'
        const currentByLeague = { ...(car.reserveDriverUserIdsByLeague || {}) }
        const currentList = [...(currentByLeague[targetLeagueKey] || [])]
        while (currentList.length < MAX_RESERVE_DRIVERS_PER_CAR) currentList.push('')
        currentList[driverIndex] = cleanUserId
        currentByLeague[targetLeagueKey] = currentList
        const carLeagueKey = car.leagueId || targetLeagueKey
        const primaryReserveList = currentByLeague[carLeagueKey] || currentList
        return {
          ...car,
          reserveDriverUserIdsByLeague: currentByLeague,
          reserveDriverUserIds: primaryReserveList.map((d) => String(d || '').trim()),
        }
      }),
    )
  }

  const handleSkinFileUpload = async (carId: string, file: File) => {
    setUploadingCarId(carId)
    try {
      const car = cars.find((c) => c.id === carId)
      const league = car ? leaguesOptions.find((l) => l.id === car.leagueId || l.slug === car.leagueId) : undefined
      const folder = car ? `skins/${car.category}/${league?.slug || 'general'}` : undefined
      const finalSkinUrl = await uploadSkinFile(file, folder)
      if (finalSkinUrl) {
        setCars((prev) =>
          prev.map((c) => (c.id === carId ? { ...c, skinUrl: finalSkinUrl, skinName: file.name } : c)),
        )
      } else {
        alert('Could not upload skin file directly. Please paste a Google Drive, Mega, or MediaFire download link in the field below.')
      }
    } catch (err: any) {
      console.error('Skin upload failed:', err)
      alert(err?.message || 'Error connecting to server to upload file.')
    } finally {
      setUploadingCarId(null)
    }
  }

  const filteredCars = useMemo(() => {
    if (activeTab === 'all') return cars
    return cars.filter((car) => {
      if (car.leagueId && (car.leagueId === activeTab || car.leagueId === activeLeague?.slug)) return true
      if (!car.leagueId && activeLeague?.classTags && activeLeague.classTags.length > 0) {
        return activeLeague.classTags.some((tag) => tag.toUpperCase() === car.category.toUpperCase())
      }
      return false
    })
  }, [cars, activeTab, activeLeague])

  const availableCategories = useMemo((): Array<'GT3' | 'LMP2' | 'HYPERCAR'> => {
    if (!activeLeague || activeTab === 'all' || !activeLeague.classTags || activeLeague.classTags.length === 0) {
      return CATEGORIES
    }
    const leagueTags = activeLeague.classTags.map((t) => t.toUpperCase())
    const filtered = CATEGORIES.filter((cat) => leagueTags.includes(cat.toUpperCase()))
    return filtered.length > 0 ? filtered : CATEGORIES
  }, [activeTab, activeLeague])

  return {
    cars,
    setCars,
    activeTab,
    setActiveTab,
    activeLeague,
    uploadingCarId,
    carValidation,
    hasErrors,
    serialized,
    filteredCars,
    availableCategories,
    getAssignedDriverIdsForLeague,
    addCar,
    removeCar,
    updateCarField,
    updateCarDriver,
    updateCarReserveDriver,
    getCarDriversForLeague,
    getCarReserveDriversForLeague,
    handleSkinFileUpload,
  }
}
