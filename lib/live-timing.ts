import { createClient } from '@supabase/supabase-js'

export type Split = { SplitIndex: number; SplitTime: number }

export type CarStats = {
  BestLap?: number
  LastLap?: number
  BestSplits?: Record<string, Split>
  CurrentLapSplits?: Record<string, Split>
}

export type CarInfo = {
  CarModel?: string
  CarName?: string
  DriverName?: string
  TeamName?: string
  RaceNumber?: string
  Tyres?: string
  DriverGUID?: string
}

export type LiveDriver = {
  Position: number
  Split?: string
  IsInPits?: boolean
  NumLongPits?: number
  NumPits?: number
  TotalNumLaps?: number
  LastPitStop?: string
  LastSeen?: string
  CarInfo?: CarInfo
  Cars?: Record<string, CarStats>
  LastPos?: { X: number; Y: number; Z: number }
  NormalisedSplinePos?: number
}

export type LeaderboardResponse = {
  ServerName?: string
  Track?: string
  TrackConfig?: string
  AmbientTemp?: number
  RoadTemp?: number
  Time?: number
  ElapsedMilliseconds?: number
  ConnectedDrivers?: LiveDriver[]
  DisconnectedDrivers?: LiveDriver[]
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseLiveTiming =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

export async function fetchOfficialStints(): Promise<Record<string, number>> {
  if (!supabaseLiveTiming) return {}
  const { data, error } = await supabaseLiveTiming.from('driver_stints').select('guid, total_ms')
  if (error || !data) return {}
  return data.reduce((acc: Record<string, number>, row: any) => {
    acc[row.guid] = row.total_ms
    return acc
  }, {})
}

export function getCarStats(driver: LiveDriver): CarStats {
  if (!driver?.Cars) return {}
  const model = driver.CarInfo?.CarModel
  if (model && driver.Cars[model]) return driver.Cars[model]
  return Object.values(driver.Cars)[0] || {}
}

// The server reports each car by its real Assetto Corsa folder name (e.g.
// "porsche_963_2023"), not by class — none of the real Hypercar/LMDh folders in our pack
// contain "hypercar"/"lmh"/"lmdh" as a substring, so the old heuristic silently fell through
// to GT3 for every one of them. This is the same 25-car pack (and folder names, verified
// against the real installed content) as DEFAULT_VEHICLE_MODELS in vehicle-selector-modal.tsx.
const CAR_FOLDER_CLASS: Record<string, string> = {
  // GT3
  acf_aston_martin_vantage_gt3_evo: 'GT3',
  fsr_audi_lms_evo_2_gt3: 'GT3',
  bentley_continental_gt3_18: 'GT3',
  ks_bmw_m4_gt3_2022: 'GT3',
  corvette_z06_gt3_2024: 'GT3',
  ks_ferrari_296_gt3_2023: 'GT3',
  ford_mustang_gt3_2024: 'GT3',
  ac_friends_honda_nsx_gt3_evo: 'GT3',
  lamborghini_huracan_evo2_gt3: 'GT3',
  ng_lexus_r_cf_gt3: 'GT3',
  mclaren_720s_gt3_evo: 'GT3',
  bm_amg_evo_2020_gt3: 'GT3',
  bm_nissan_gtr_gt3: 'GT3',
  porsche_992_gt3_r_2023: 'GT3',
  // HYPERCAR
  alpine_a424: 'HYPERCAR',
  fsr_aston_martin_valkyrie: 'HYPERCAR',
  bmw_m_hybrid_v8_2023: 'HYPERCAR',
  cadillac_v_series_r_2023: 'HYPERCAR',
  ferrari_499p_2023: 'HYPERCAR',
  lamborghini_sc63: 'HYPERCAR',
  peugeot_9x8: 'HYPERCAR',
  porsche_963_2023: 'HYPERCAR',
  toyota_gr010: 'HYPERCAR',
  // LMP2
  lmp2_ligier_jsp217: 'LMP2',
  acf_oreca_07: 'LMP2',
}

/** Maps a raw simulator car model string to one of the site's established class tags. */
export function getClassTagFromModel(carModel?: string): string {
  const raw = (carModel || '').trim()
  const known = CAR_FOLDER_CLASS[raw] || CAR_FOLDER_CLASS[raw.toLowerCase()]
  if (known) return known

  // Fallback heuristic for any car outside the known 25-car pack (e.g. GT4, or a folder
  // added to the server later that this table hasn't been updated for yet).
  const m = raw.toLowerCase()
  if (m.includes('hypercar') || m.includes('lmh') || m.includes('lmdh')) return 'HYPERCAR'
  if (m.includes('lmp2') || m.includes('lmp3') || m.includes('lmp1')) return 'LMP2'
  if (m.includes('tcr')) return 'TCR'
  if (m.includes('gt4')) return 'GT4'
  return 'GT3'
}

export const CLASS_COLORS: Record<string, string> = {
  HYPERCAR: '#e10600',
  LMP2: '#0072f0',
  GT3: '#009f00',
  GT4: '#009f00',
  TCR: '#f59e0b',
}

export function formatNanos(n?: number): string {
  if (!n || n <= 0 || n > 3_600_000_000_000) return '-'
  const s = n / 1e9
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 1000)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

export function formatSeconds(s: number): string {
  if (!s || s < 0) return '00:00:00'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const t = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return d > 0 ? `${d}d ${t}` : t
}

export function formatStintMs(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
