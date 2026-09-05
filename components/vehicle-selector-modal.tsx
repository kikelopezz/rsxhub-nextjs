'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Check, ChevronRight, ChevronLeft, Gauge, Flag, Zap, LayoutGrid, Download, FolderArchive } from 'lucide-react'
import { CenterModal } from '@/components/center-modal'
import { listCarCatalogFilesAction } from '@/app/admin/actions/admin-catalog'
import type { CatalogFile } from '@/lib/admin-catalog'
import type { VehicleModelOption } from './team-cars-editor/types'

function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Best-effort match between a car model and an uploaded catalog file — the catalog is just
// admin-uploaded ZIPs named however the admin named them, so this can't be a guaranteed FK
// join. Matching on the AC folder name (a stable, unique identifier) first, falling back to
// the display name, covers the common "named the zip after the mod" case without being
// fooled by short substrings.
function findCatalogMatch(vehicle: VehicleModelOption, files: CatalogFile[]): CatalogFile | null {
  const folder = normalizeForMatch(vehicle.acFolder)
  const name = normalizeForMatch(vehicle.name)
  return (
    files.find((f) => {
      const fileName = normalizeForMatch(f.name)
      return (folder.length > 3 && fileName.includes(folder)) || (name.length > 3 && fileName.includes(name))
    }) || null
  )
}

// Default list of car models with their real Assetto Corsa folder names — this is the
// actual "ACF" pack the league races on. Folder names were verified one by one against
// the real installed content (content/cars/<folder>/ui/ui_car.json), not guessed. Photos
// are each car's own real in-sim preview render, pulled straight from one of its skin
// folders (content/cars/<folder>/skins/<skin>/preview.jpg) — not stock/stand-in photos.
export const DEFAULT_VEHICLE_MODELS: VehicleModelOption[] = [
  // GT3 — raced in both ERC and ERC NEXT GEN
  { id: 'gt3_aston_vantage_evo', name: 'Aston Martin Vantage GT3 EVO 2024', acFolder: 'acf_aston_martin_vantage_gt3_evo', category: 'GT3', manufacturer: 'Aston Martin', imageUrl: '/vehicles/gt3_aston_vantage_evo.jpg' },
  { id: 'gt3_bmw_m4', name: 'BMW M4 GT3 2021', acFolder: 'ks_bmw_m4_gt3_2022', category: 'GT3', manufacturer: 'BMW', imageUrl: '/vehicles/gt3_bmw_m4.jpg' },
  { id: 'gt3_corvette_z06', name: 'Chevrolet Corvette Z06 GT3R 2024', acFolder: 'corvette_z06_gt3_2024', category: 'GT3', manufacturer: 'Chevrolet', imageUrl: '/vehicles/gt3_corvette_z06.jpg' },
  { id: 'gt3_ferrari_296', name: 'Ferrari 296 GT3 2023', acFolder: 'ks_ferrari_296_gt3_2023', category: 'GT3', manufacturer: 'Ferrari', imageUrl: '/vehicles/gt3_ferrari_296.jpg' },
  { id: 'gt3_ford_mustang', name: 'Ford Mustang GT3 2024', acFolder: 'ford_mustang_gt3_2024', category: 'GT3', manufacturer: 'Ford', imageUrl: '/vehicles/gt3_ford_mustang.jpg' },
  { id: 'gt3_lamborghini_huracan_evo2', name: 'Lamborghini Huracan GT3 EVO II 2023', acFolder: 'lamborghini_huracan_evo2_gt3', category: 'GT3', manufacturer: 'Lamborghini', imageUrl: '/vehicles/gt3_lamborghini_huracan_evo2.jpg' },
  { id: 'gt3_lexus_rcf', name: 'Lexus RC F GT3 2016', acFolder: 'ng_lexus_r_cf_gt3', category: 'GT3', manufacturer: 'Lexus', imageUrl: '/vehicles/gt3_lexus_rcf.jpg' },
  { id: 'gt3_mclaren_720s_evo', name: 'McLaren 720S GT3 EVO 2023', acFolder: 'mclaren_720s_gt3_evo', category: 'GT3', manufacturer: 'McLaren', imageUrl: '/vehicles/gt3_mclaren_720s_evo.jpg' },
  { id: 'gt3_mercedes_amg_evo', name: 'Mercedes-AMG GT3 EVO 2020', acFolder: 'bm_amg_evo_2020_gt3', category: 'GT3', manufacturer: 'Mercedes', imageUrl: '/vehicles/gt3_mercedes_amg_evo.jpg' },
  { id: 'gt3_porsche_992', name: 'Porsche 992 GT3 R 2023', acFolder: 'porsche_992_gt3_r_2023', category: 'GT3', manufacturer: 'Porsche', imageUrl: '/vehicles/gt3_porsche_992.jpg' },

  // HYPERCAR — ERC only
  { id: 'hy_alpine_a424', name: 'Alpine A424 LMDh 2024', acFolder: 'alpine_a424', category: 'HYPERCAR', manufacturer: 'Alpine', imageUrl: '/vehicles/hy_alpine_a424.jpg' },
  { id: 'hy_aston_martin_v12', name: 'Aston Martin V12 LMDh 2025', acFolder: 'fsr_aston_martin_valkyrie', category: 'HYPERCAR', manufacturer: 'Aston Martin', imageUrl: '/vehicles/hy_aston_martin_v12-v2.jpg' },
  { id: 'hy_bmw_m_hybrid_v8', name: 'BMW M Hybrid V8 LMDh 2024', acFolder: 'bmw_m_hybrid_v8_2023', category: 'HYPERCAR', manufacturer: 'BMW', imageUrl: '/vehicles/hy_bmw_m_hybrid_v8.jpg' },
  { id: 'hy_cadillac_v_series', name: 'Cadillac V-Series R LMDh 2023', acFolder: 'cadillac_v_series_r_2023', category: 'HYPERCAR', manufacturer: 'Cadillac', imageUrl: '/vehicles/hy_cadillac_v_series.jpg' },
  { id: 'hy_ferrari_499p', name: 'Ferrari 499P LMH 2023', acFolder: 'ferrari_499p_2023', category: 'HYPERCAR', manufacturer: 'Ferrari', imageUrl: '/vehicles/hy_ferrari_499p.jpg' },
  { id: 'hy_lamborghini_sc63', name: 'Lamborghini SC63 LMDh 2024', acFolder: 'lamborghini_sc63', category: 'HYPERCAR', manufacturer: 'Lamborghini', imageUrl: '/vehicles/hy_lamborghini_sc63.jpg' },
  { id: 'hy_peugeot_9x8', name: 'Peugeot 9X8 2024 LMH', acFolder: 'peugeot_9x8', category: 'HYPERCAR', manufacturer: 'Peugeot', imageUrl: '/vehicles/hy_peugeot_9x8.jpg' },
  { id: 'hy_porsche_963', name: 'Porsche 963 LMDh 2023', acFolder: 'porsche_963_2023', category: 'HYPERCAR', manufacturer: 'Porsche', imageUrl: '/vehicles/hy_porsche_963.jpg' },
  { id: 'hy_toyota_gr010', name: 'Toyota GR010 LMH 2024', acFolder: 'toyota_gr010', category: 'HYPERCAR', manufacturer: 'Toyota', imageUrl: '/vehicles/hy_toyota_gr010.jpg' },

  // LMP2 — ERC NEXT GEN only
  { id: 'lmp2_ligier_jsp217', name: 'Ligier JS P217 2017', acFolder: 'lmp2_ligier_jsp217', category: 'LMP2', manufacturer: 'Ligier', imageUrl: '/vehicles/lmp2_ligier_jsp217.jpg' },
  { id: 'lmp2_oreca_07', name: 'Oreca 07 2023', acFolder: 'acf_oreca_07', category: 'LMP2', manufacturer: 'Oreca', imageUrl: '/vehicles/lmp2_oreca_07.jpg' },
]

const CATEGORY_THEME: Record<string, { hex: string; soft: string; text: string; Icon: typeof Gauge }> = {
  GT3: { hex: '#009f00', soft: 'rgba(0,159,0,0.14)', text: 'text-emerald-400', Icon: Flag },
  LMP2: { hex: '#0072f0', soft: 'rgba(0,114,240,0.14)', text: 'text-blue-400', Icon: Gauge },
  HYPERCAR: { hex: '#e10600', soft: 'rgba(225,6,0,0.14)', text: 'text-red-400', Icon: Zap },
}

export function VehicleSelectorModal({
  selectedCategory,
  selectedModelName,
  selectedModelFolder,
  onSelect,
  onClear,
  customVehicles = DEFAULT_VEHICLE_MODELS,
  triggerClassName,
}: {
  selectedCategory?: 'GT3' | 'LMP2' | 'HYPERCAR' | string
  selectedModelName?: string
  selectedModelFolder?: string
  onSelect: (vehicle: { name: string; acFolder: string; category: string }) => void
  onClear?: () => void
  customVehicles?: VehicleModelOption[]
  triggerClassName?: string
}) {
  const [search, setSearch] = useState('')
  const targetCategory = selectedCategory ? selectedCategory.toUpperCase() : null
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>(targetCategory || 'ALL')
  // Which car is showing in the hero — separate from the actual selection, so browsing with
  // the flip arrows / filmstrip previews a car without committing to it until you hit
  // "Seleccionar este coche". Identity-based (not an index) so it survives search filtering.
  const [previewId, setPreviewId] = useState<string | null>(null)

  const [catalogFiles, setCatalogFiles] = useState<CatalogFile[]>([])
  useEffect(() => {
    listCarCatalogFilesAction()
      .then(setCatalogFiles)
      .catch(() => {})
  }, [])

  const selectedVehicle = customVehicles.find((v) => v.acFolder === selectedModelFolder || v.name === selectedModelName)

  const counts = useMemo(() => {
    const byCategory: Record<string, number> = { ALL: customVehicles.length }
    for (const v of customVehicles) {
      const cat = v.category.toUpperCase()
      byCategory[cat] = (byCategory[cat] || 0) + 1
    }
    return byCategory
  }, [customVehicles])

  const filteredVehicles = useMemo(() => {
    return customVehicles.filter((v) => {
      const matchesCategory = targetCategory
        ? v.category.toUpperCase() === targetCategory
        : activeCategoryFilter === 'ALL' || v.category.toUpperCase() === activeCategoryFilter.toUpperCase()

      const s = search.trim().toLowerCase()
      const matchesSearch =
        !s ||
        v.name.toLowerCase().includes(s) ||
        v.acFolder.toLowerCase().includes(s) ||
        (v.manufacturer && v.manufacturer.toLowerCase().includes(s))

      return matchesCategory && matchesSearch
    })
  }, [customVehicles, targetCategory, activeCategoryFilter, search])

  const activeVehicle =
    filteredVehicles.find((v) => v.id === previewId) ||
    filteredVehicles.find((v) => v.acFolder === selectedModelFolder || v.name === selectedModelName) ||
    filteredVehicles[0] ||
    null
  const activeIdx = activeVehicle ? filteredVehicles.findIndex((v) => v.id === activeVehicle.id) : -1
  const isActiveSelected = !!activeVehicle && (selectedModelFolder === activeVehicle.acFolder || selectedModelName === activeVehicle.name)
  const activeCatalogMatch = activeVehicle ? findCatalogMatch(activeVehicle, catalogFiles) : null

  const flip = (delta: number) => {
    if (filteredVehicles.length === 0) return
    const base = activeIdx >= 0 ? activeIdx : 0
    const next = (base + delta + filteredVehicles.length) % filteredVehicles.length
    setPreviewId(filteredVehicles[next].id)
  }

  const triggerLabelContent = (
    <div className="flex w-full items-center justify-between gap-2 text-left">
      <div className="flex min-w-0 items-center gap-2.5">
        {selectedVehicle?.imageUrl ? (
          <span className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
            <Image src={selectedVehicle.imageUrl} alt="" fill sizes="48px" className="object-cover" />
          </span>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-500/60 bg-amber-500/10 text-amber-400">
            <LayoutGrid className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0">
          {selectedModelName ? (
            <span className="block truncate text-xs font-bold leading-tight text-white">{selectedModelName}</span>
          ) : (
            <span className="block text-xs font-bold text-amber-300">Select Vehicle Model *</span>
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
        } rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2 hover:border-cyan-400 transition-colors cursor-pointer font-semibold shadow-inner`
      }
      widthClassName="w-[min(1080px,95vw)]"
    >
      {(close) => (
      <div className="flex flex-col gap-4 bg-[#090d16] text-white">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, fabricante o carpeta..."
            className="w-full rounded-lg border border-slate-700 bg-[#0a0f1d] py-2.5 pl-10 pr-3 font-mono-data text-xs text-white outline-none transition-colors focus:border-cyan-400"
          />
        </div>

        {/* Category selector — flat pill: single line, icon + label + count. The locked case
            is what's actually used in production today (a car's category is fixed before this
            modal opens); the browsing case below is unused dead code kept for future reuse. */}
        {targetCategory ? (
          (() => {
            const theme = CATEGORY_THEME[targetCategory]
            const LockedIcon = theme?.Icon || LayoutGrid
            return (
              <div
                className="flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5"
                style={{ borderColor: (theme?.hex || '#4ea1ff') + '66', background: theme?.soft || 'rgba(78,161,255,0.12)' }}
              >
                <LockedIcon className="h-4 w-4 shrink-0" style={{ color: theme?.hex }} />
                <span className={`font-display-condensed text-sm font-bold ${theme?.text}`}>{targetCategory}</span>
                <span className="font-body text-xs text-slate-300">· categoría bloqueada</span>
                <span
                  className="ml-auto border-l pl-2.5 font-mono-data text-[11px] text-slate-400"
                  style={{ borderColor: (theme?.hex || '#4ea1ff') + '55' }}
                >
                  {filteredVehicles.length} disponibles
                </span>
              </div>
            )
          })()
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['ALL', 'GT3', 'LMP2', 'HYPERCAR'] as const).map((cat) => {
              const theme = CATEGORY_THEME[cat]
              const active = activeCategoryFilter === cat
              const Icon = theme?.Icon || LayoutGrid
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left font-display-condensed text-xs font-bold transition-colors cursor-pointer ${
                    active ? 'text-white shadow-lg' : 'border-slate-800 bg-[#0e1626] text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                  style={active ? { borderColor: theme?.hex || '#4ea1ff', background: theme?.soft || 'rgba(78,161,255,0.12)' } : undefined}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={active ? { color: theme?.hex } : undefined} />
                  <span className="truncate">{cat === 'ALL' ? 'Todos' : cat}</span>
                  <span className="ml-auto font-mono-data text-[10px] font-normal opacity-70">{counts[cat] || 0}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Showroom: one car at a time in the hero, flipped through with the side arrows or
            picked directly from the filmstrip below. Browsing only *previews* a car — nothing
            is applied until "Seleccionar este coche", unlike the old grid where every click
            committed immediately. */}
        {filteredVehicles.length === 0 || !activeVehicle ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-800 py-12 text-center">
            <Search className="h-7 w-7 text-slate-600" />
            <p className="text-xs text-slate-400">Ningún vehículo coincide con la búsqueda.</p>
          </div>
        ) : (
          <>
            {(() => {
              const theme = CATEGORY_THEME[activeVehicle.category.toUpperCase()] || CATEGORY_THEME.GT3
              return (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => flip(-1)}
                    aria-label="Coche anterior"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0e1626] text-slate-400 transition-colors hover:border-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>

                  <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-[#0e1626]">
                    <div className="relative aspect-[20/9] w-full overflow-hidden bg-black/60">
                      {activeVehicle.imageUrl ? (
                        <Image
                          key={activeVehicle.id}
                          src={activeVehicle.imageUrl}
                          alt={activeVehicle.name}
                          fill
                          sizes="900px"
                          className="object-cover"
                          priority
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-700">
                          <Gauge className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                      <span className="absolute left-4 top-4 rounded-full border border-slate-700 bg-black/55 px-2.5 py-1 font-mono-data text-[11px] text-slate-300">
                        {String(activeIdx + 1).padStart(2, '0')} / {filteredVehicles.length}
                      </span>
                      <span
                        className="absolute right-4 top-4 rounded px-2.5 py-1 font-display-condensed text-[11px] font-black uppercase tracking-wider text-white"
                        style={{ background: theme.hex }}
                      >
                        {activeVehicle.category}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <h3 className="truncate font-display-condensed text-2xl font-bold text-white drop-shadow">{activeVehicle.name}</h3>
                          {activeVehicle.manufacturer && (
                            <p className="font-mono-data text-xs uppercase tracking-wide text-slate-300">{activeVehicle.manufacturer}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                          <span className="font-mono-data text-[10.5px] text-slate-400">{activeVehicle.acFolder}</span>
                          <span className="font-mono-data text-[10.5px] text-emerald-400/90">✓ ruta verificada</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
                      <span className="font-mono-data text-[11px] text-slate-500">
                        Usa las flechas o el carrete de abajo para cambiar de coche
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {activeCatalogMatch && (
                          <a
                            href={activeCatalogMatch.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={activeCatalogMatch.name}
                            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 font-display-condensed text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/20 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Descargar coche
                          </a>
                        )}
                      {isActiveSelected ? (
                        <div className="flex shrink-0 items-center gap-3">
                          <span
                            className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 font-display-condensed text-xs font-bold ${theme.text}`}
                            style={{ borderColor: theme.hex }}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                            Coche actual del equipo
                          </span>
                          {onClear && (
                            <button
                              type="button"
                              onClick={onClear}
                              className="font-mono-data text-[11px] text-rose-400 underline decoration-dotted underline-offset-4 hover:text-rose-300 cursor-pointer"
                            >
                              quitar
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelect({ name: activeVehicle.name, acFolder: activeVehicle.acFolder, category: activeVehicle.category })
                            close()
                          }}
                          className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 font-display-condensed text-xs font-bold text-[#04160c] cursor-pointer"
                          style={{ background: `linear-gradient(135deg, ${theme.hex}, ${theme.hex})` }}
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          Seleccionar este coche
                        </button>
                      )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => flip(1)}
                    aria-label="Siguiente coche"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0e1626] text-slate-400 transition-colors hover:border-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              )
            })()}

            {/* Filmstrip — overscroll-contain stops the scroll from "chaining" into the
                modal's own outer scroll container once you hit either end of the row. */}
            <div>
              <div className="mb-2 flex items-center justify-between font-mono-data text-[10px] uppercase tracking-wider text-slate-500">
                <span>Carrete{targetCategory ? ` ${targetCategory}` : ''}</span>
                <span>{filteredVehicles.length} disponibles</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto overscroll-contain pb-1">
                {filteredVehicles.map((v) => {
                  const isPreviewed = v.id === activeVehicle.id
                  const isChosen = selectedModelFolder === v.acFolder || selectedModelName === v.name
                  const theme = CATEGORY_THEME[v.category.toUpperCase()] || CATEGORY_THEME.GT3
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPreviewId(v.id)}
                      className={`group w-[124px] shrink-0 overflow-hidden rounded-lg border text-left transition-colors cursor-pointer ${
                        isPreviewed ? '' : 'border-slate-800 bg-[#0e1626] hover:border-slate-700'
                      }`}
                      style={isPreviewed ? { borderColor: theme.hex, boxShadow: `0 0 0 1px ${theme.hex}`, background: '#101a2c' } : undefined}
                    >
                      <span className="relative block aspect-[16/10] w-full overflow-hidden bg-black/60">
                        {v.imageUrl ? (
                          <Image src={v.imageUrl} alt={v.name} fill sizes="124px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-slate-700">
                            <Gauge className="h-5 w-5" />
                          </span>
                        )}
                        {isChosen && (
                          <span
                            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                            style={{ background: theme.hex }}
                          >
                            <Check className="h-2.5 w-2.5 stroke-[4]" />
                          </span>
                        )}
                      </span>
                      <span className="block truncate px-1.5 py-1 font-display-condensed text-[10.5px] font-bold text-white">{v.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Not every model in this list has a matching upload — fall back to the whole
                catalog so the file is still reachable, even when the name doesn't line up. */}
            {catalogFiles.length > 0 && (
              <details className="rounded-lg border border-slate-800 bg-[#0e1626]">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 font-mono-data text-[11px] uppercase tracking-wider text-slate-400 hover:text-white">
                  <FolderArchive className="h-3.5 w-3.5" />
                  Catálogo completo de archivos de coches ({catalogFiles.length})
                </summary>
                <div className="max-h-40 space-y-1 overflow-y-auto border-t border-slate-800 p-2">
                  {catalogFiles.map((f) => (
                    <a
                      key={f.key}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-cyan-300"
                    >
                      <span className="truncate">{f.name}</span>
                      <Download className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
      )}
    </CenterModal>
  )
}
