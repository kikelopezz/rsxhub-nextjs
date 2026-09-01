'use client'

import { useState, useMemo } from 'react'
import { Search, Car, Check, Folder, ChevronRight } from 'lucide-react'
import { CenterModal } from '@/components/center-modal'
import type { VehicleModelOption } from './team-cars-editor/types'

// Default initial list of car models with their Assetto Corsa folder names.
export const DEFAULT_VEHICLE_MODELS: VehicleModelOption[] = [
  // GT3
  { id: 'gt3_aston_vantage_evo', name: 'ASTON MARTIN VANTAGE GT3 EVO', acFolder: 'ks_aston_vantage_gt3_evo', category: 'GT3', manufacturer: 'Aston Martin' },
  { id: 'gt3_bmw_m4', name: 'BMW M4 GT3', acFolder: 'bmw_m4_gt3', category: 'GT3', manufacturer: 'BMW' },
  { id: 'gt3_corvette_z06', name: 'CORVETTE Z06 GT3.R', acFolder: 'corvette_z06_gt3r', category: 'GT3', manufacturer: 'Chevrolet' },
  { id: 'gt3_ferrari_296', name: 'FERRARI 296 GT3', acFolder: 'ks_ferrari_296_gt3', category: 'GT3', manufacturer: 'Ferrari' },
  { id: 'gt3_ford_mustang', name: 'FORD MUSTANG GT3', acFolder: 'ford_mustang_gt3', category: 'GT3', manufacturer: 'Ford' },
  { id: 'gt3_lamborghini_huracan_evo', name: 'LAMBORGHINI HURACÁN GT3 EVO', acFolder: 'ks_lamborghini_huracan_gt3_evo', category: 'GT3', manufacturer: 'Lamborghini' },
  { id: 'gt3_lexus_rcf', name: 'LEXUS RC F GT3', acFolder: 'ks_lexus_rc_f_gt3', category: 'GT3', manufacturer: 'Lexus' },
  { id: 'gt3_mclaren_720s_evo', name: 'McLAREN 720S GT3 EVO', acFolder: 'ks_mclaren_720s_gt3_evo', category: 'GT3', manufacturer: 'McLaren' },
  { id: 'gt3_mercedes_amg_evo', name: 'MERCEDES-AMG GT3 EVO', acFolder: 'ks_mercedes_amg_gt3_evo', category: 'GT3', manufacturer: 'Mercedes' },
  { id: 'gt3_porsche_992', name: 'PORSCHE 992 GT3 R', acFolder: 'ks_porsche_992_gt3_r', category: 'GT3', manufacturer: 'Porsche' },

  // LMP2
  { id: 'lmp2_oreca_07', name: 'ORECA 07 GIBSON LMP2', acFolder: 'oreca_07_lmp2', category: 'LMP2', manufacturer: 'Oreca' },

  // HYPERCAR
  { id: 'hc_bmw_m_hybrid_v8', name: 'BMW M Hybrid V8', acFolder: 'emka_LMDH_bmw_m_hybrid_v8', category: 'HYPERCAR', manufacturer: 'BMW' },
  { id: 'hc_cadillac_v_series', name: 'Cadillac V-Series.R', acFolder: 'emka_LMDH_cadillac_v_series', category: 'HYPERCAR', manufacturer: 'Cadillac' },
  { id: 'hc_genesis_gmr_001', name: 'Genesis GMR-001', acFolder: 'emka_LMDH_genesis_gmr_001', category: 'HYPERCAR', manufacturer: 'Genesis' },
  { id: 'hc_porsche_963', name: 'Porsche 963', acFolder: 'emka_LMDH_porsche_963', category: 'HYPERCAR', manufacturer: 'Porsche' },
  { id: 'hc_aston_martin_valkyrie', name: 'Aston Martin Valkyrie', acFolder: 'emka_LMH_astonmartinvalkyrie', category: 'HYPERCAR', manufacturer: 'Aston Martin' },
  { id: 'hc_ferrari_499p', name: 'Ferrari 499P', acFolder: 'emka_LMH_ferrari_499p', category: 'HYPERCAR', manufacturer: 'Ferrari' },
  { id: 'hc_peugeot_9x8', name: 'Peugeot 9X8', acFolder: 'emka_LMH_peugeot_9x8', category: 'HYPERCAR', manufacturer: 'Peugeot' },
  { id: 'hc_toyota_gr010', name: 'Toyota GR010 Hybrid', acFolder: 'emka_LMH_toyota_GR010', category: 'HYPERCAR', manufacturer: 'Toyota' },
]

export function VehicleSelectorModal({
  selectedCategory,
  selectedModelName,
  selectedModelFolder,
  onSelect,
  customVehicles = DEFAULT_VEHICLE_MODELS,
  triggerClassName,
}: {
  selectedCategory?: 'GT3' | 'LMP2' | 'HYPERCAR' | string
  selectedModelName?: string
  selectedModelFolder?: string
  onSelect: (vehicle: { name: string; acFolder: string; category: string }) => void
  customVehicles?: VehicleModelOption[]
  triggerClassName?: string
}) {
  const [search, setSearch] = useState('')
  const targetCategory = selectedCategory ? selectedCategory.toUpperCase() : null

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>(
    targetCategory || 'ALL'
  )

  const filteredVehicles = useMemo(() => {
    return customVehicles.filter((v) => {
      const matchesCategory = targetCategory
        ? v.category.toUpperCase() === targetCategory
        : (activeCategoryFilter === 'ALL' || v.category.toUpperCase() === activeCategoryFilter.toUpperCase())

      const s = search.trim().toLowerCase()
      const matchesSearch =
        !s ||
        v.name.toLowerCase().includes(s) ||
        v.acFolder.toLowerCase().includes(s) ||
        (v.manufacturer && v.manufacturer.toLowerCase().includes(s))

      return matchesCategory && matchesSearch
    })
  }, [customVehicles, targetCategory, activeCategoryFilter, search])

  const categoryThemes: Record<string, string> = {
    GT3: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
    LMP2: 'border-blue-500/40 bg-blue-950/40 text-blue-300',
    HYPERCAR: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
  }

  const triggerLabelContent = (
    <div className="flex items-center justify-between gap-2 w-full text-left">
      <div className="flex items-center gap-2 min-w-0">
        <Car className={`h-4 w-4 shrink-0 ${selectedModelName ? 'text-cyan-400' : 'text-amber-400 animate-pulse'}`} />
        <div className="truncate">
          {selectedModelName ? (
            <span className="font-bold text-white leading-tight block truncate">{selectedModelName}</span>
          ) : (
            <span className="font-bold text-amber-300 block">Select Vehicle Model *</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </div>
  )

  return (
    <CenterModal
      title={targetCategory ? `Select ${targetCategory} Vehicle` : 'Select Vehicle Model'}
      triggerLabel={triggerLabelContent as any}
      triggerClassName={
        triggerClassName ||
        `w-full bg-[#0a0f1d] border ${
          selectedModelName ? 'border-cyan-500/60 text-white' : 'border-dashed border-amber-500/60 text-amber-300'
        } rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2 hover:border-cyan-400 transition-all cursor-pointer font-semibold shadow-inner`
      }
      widthClassName="w-[min(820px,94vw)]"
    >
      <div className="space-y-4 p-2 bg-[#090d16] text-white">
        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Category Filter Pills / Lock Badge */}
          {targetCategory ? (
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-lg">
              <span>Category:</span>
              <span className="font-mono text-white bg-cyan-500/20 px-2 py-0.5 rounded">{targetCategory}</span>
              <span className="text-slate-400 font-mono font-normal">({filteredVehicles.length} available)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['ALL', 'GT3', 'LMP2', 'HYPERCAR'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    activeCategoryFilter === cat
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : 'bg-[#131d31]/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model name..."
              className="w-full bg-[#0a0f1d] border border-slate-700 focus:border-cyan-400 text-xs text-white rounded-lg pl-8 pr-3 py-2 outline-none font-mono"
            />
          </div>
        </div>

        {/* Vehicle List */}
        <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg">
              <Car className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No vehicles match your search filter.</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredVehicles.map((v) => {
                const isSelected =
                  selectedModelFolder === v.acFolder || selectedModelName === v.name
                const catTheme = categoryThemes[v.category] || 'border-cyan-500/40 text-cyan-300'

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      onSelect({
                        name: v.name,
                        acFolder: v.acFolder,
                        category: v.category,
                      })
                    }}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'bg-[#11192a] border-slate-800 hover:border-slate-700 hover:bg-[#152035]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white truncate">{v.name}</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border rounded ${catTheme}`}>
                          {v.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/80">
                        <Folder className="h-3 w-3 shrink-0 text-cyan-500" />
                        <span className="truncate">content/cars/{v.acFolder}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="h-6 w-6 rounded-full bg-cyan-500 text-black flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </CenterModal>
  )
}
