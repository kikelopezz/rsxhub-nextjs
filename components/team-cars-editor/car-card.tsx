'use client'

import { Trash, AlertTriangle, Users, Upload, FileArchive } from 'lucide-react'
import { VehicleSelectorModal } from '@/components/vehicle-selector-modal'
import { getSkinFileName, MAX_DRIVERS_PER_CAR } from './types'
import type { CarEntry, TeamMemberOption, LeagueOption } from './types'
import { useDictionary } from '@/lib/i18n/locale-provider'

export const categoryThemes: Record<string, { text: string; badge: string; headerText: string }> = {
  HYPERCAR: {
    text: 'text-rose-400 font-extrabold',
    headerText: 'text-rose-400 font-black tracking-wider',
    badge: 'border-rose-500/40 bg-rose-950/50 text-rose-300',
  },
  LMP2: {
    text: 'text-blue-400 font-extrabold',
    headerText: 'text-blue-400 font-black tracking-wider',
    badge: 'border-blue-500/40 bg-blue-950/50 text-blue-300',
  },
  GT3: {
    text: 'text-emerald-400 font-extrabold',
    headerText: 'text-emerald-400 font-black tracking-wider',
    badge: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300',
  },
}

type CarCardProps = {
  car: CarEntry
  carErrors: string[] | undefined
  activeTab: string
  leaguesOptions: LeagueOption[]
  teamMembers: TeamMemberOption[]
  assignedDriverUserIds: Set<string>
  uploadingCarId: string | null
  onRemove: (id: string) => void
  onUpdateField: (id: string, field: keyof CarEntry, value: any) => void
  onUpdateModel: (carId: string, name: string, acFolder: string, category: string) => void
  onUpdateDriver: (id: string, leagueKey: string, driverIdx: number, userId: string) => void
  onSkinUpload: (carId: string, file: File) => void
  onSkinClear: (carId: string) => void
  getCarDriversForLeague: (car: CarEntry, leagueKey: string) => string[]
}

export function CarCard({
  car,
  carErrors,
  activeTab,
  leaguesOptions,
  teamMembers,
  assignedDriverUserIds,
  uploadingCarId,
  onRemove,
  onUpdateField,
  onUpdateModel,
  onUpdateDriver,
  onSkinUpload,
  onSkinClear,
  getCarDriversForLeague,
}: CarCardProps) {
  const t = useDictionary().equipos.carEditor
  const theme = categoryThemes[car.category] || categoryThemes.GT3
  const hasCarError = Boolean(carErrors && carErrors.length > 0)
  const currentLeagueKey = activeTab !== 'all' ? activeTab : car.leagueId || 'general'
  const currentLeagueObj = leaguesOptions.find((l) => l.id === currentLeagueKey || l.slug === currentLeagueKey)
  const maxSlots = MAX_DRIVERS_PER_CAR
  const carDrivers = getCarDriversForLeague(car, currentLeagueKey)

  return (
    <div
      className={`bg-[#131d31]/80 border rounded-lg p-4 relative space-y-4 transition-all shadow-sm ${
        hasCarError
          ? 'border-rose-500/80 bg-rose-950/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
          : 'border-slate-700/60 hover:border-slate-600'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            {t.car} <span className={`font-black font-mono text-sm ${theme.text}`}>#{car.dorsal || '---'}</span>
          </span>
          {car.modelName && (
            <span className="text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded font-mono">
              {car.modelName}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(car.id)}
          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800/50 hover:bg-rose-950/40 border border-slate-700/50 hover:border-rose-500/40 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px]"
        >
          <Trash className="h-3.5 w-3.5" />
          <span>{t.delete}</span>
        </button>
      </div>

      {/* Per-Car Errors */}
      {hasCarError && (
        <div className="bg-rose-950/50 border border-rose-500/40 p-2.5 rounded-lg space-y-1">
          {carErrors!.map((err, idx) => (
            <p key={idx} className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Inputs: Liga → Dorsal → Vehículo → Skin */}
      <div className="grid gap-3 md:grid-cols-4">
        {/* 1. League */}
        <div>
          <label className="mb-1 block text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
            {t.assignLeague}
          </label>
          <select
            required
            value={(() => {
              const match = leaguesOptions.find((l) => l.id === car.leagueId || l.slug === car.leagueId)
              return match ? match.id : car.leagueId || ''
            })()}
            onChange={(e) => onUpdateField(car.id, 'leagueId', e.target.value || null)}
            className={`w-full bg-[#0a0f1d] border text-xs text-slate-200 rounded-lg px-3 py-2 outline-none cursor-pointer transition-all font-semibold ${
              !car.leagueId ? 'border-amber-500/60 bg-amber-950/10' : 'border-slate-700 focus:border-cyan-400'
            }`}
          >
            <option value="">{t.selectLeague}</option>
            {leaguesOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>

        {/* 2. Dorsal */}
        <div>
          <label className="mb-1 block text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
            {t.carNumber}
          </label>
          <input
            type="text"
            required
            maxLength={3}
            value={car.dorsal}
            onChange={(e) => onUpdateField(car.id, 'dorsal', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            placeholder={t.dorsalPlaceholder}
            className={`w-full bg-[#0a0f1d] border text-xs text-white rounded-lg px-3 py-2 outline-none font-mono transition-all shadow-inner ${
              !car.dorsal ? 'border-amber-500/60 bg-amber-950/10' : 'border-slate-700 focus:border-cyan-400'
            }`}
          />
        </div>

        {/* 3. Car Model */}
        <div>
          <label className="mb-1 block text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
            {t.vehicleModel}
          </label>
          <VehicleSelectorModal
            selectedCategory={car.category}
            selectedModelName={car.modelName}
            selectedModelFolder={car.modelFolder}
            onSelect={(v) => onUpdateModel(car.id, v.name, v.acFolder, v.category)}
          />
        </div>

        {/* 4. Skin */}
        <div>
          <label className="mb-1 text-[11px] text-slate-300 font-semibold uppercase tracking-wider flex items-center justify-between">
            <span>{t.compressedSkin}</span>
            {uploadingCarId === car.id && (
              <span className="text-[10px] text-cyan-400 font-normal animate-pulse">{t.uploading}</span>
            )}
          </label>
          {car.skinUrl ? (
            <div className="flex items-center gap-2 bg-[#0a0f1d] border border-emerald-500/50 rounded-lg px-3 py-1.5 text-xs text-emerald-300 min-w-0">
              <FileArchive className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="truncate flex-1 font-mono text-[11px]" title={getSkinFileName(car.skinUrl, car.skinName)}>
                {getSkinFileName(car.skinUrl, car.skinName)}
              </span>
              <button
                type="button"
                onClick={() => onSkinClear(car.id)}
                className="text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 cursor-pointer shrink-0 ml-1"
              >
                {t.delete}
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label
                className={`w-full flex items-center justify-center gap-2 bg-[#0a0f1d] border border-dashed rounded-lg px-3 py-1.5 text-xs cursor-pointer transition-all ${
                  uploadingCarId === car.id
                    ? 'border-cyan-500/50 text-cyan-300 bg-cyan-950/20'
                    : 'border-amber-500/60 hover:border-cyan-400 text-amber-300 hover:text-white bg-amber-950/10'
                }`}
              >
                <Upload className="h-4 w-4 text-cyan-400" />
                <span className="font-medium text-[11px]">
                  {uploadingCarId === car.id ? t.uploadingSkin : t.uploadSkin}
                </span>
                <input
                  type="file"
                  accept=".zip,.rar,.7z,.tar,.tar.gz,.gz"
                  className="hidden"
                  disabled={uploadingCarId === car.id}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSkinUpload(car.id, f) }}
                />
              </label>
              <input
                type="text"
                value={car.skinUrl || ''}
                onChange={(e) => onUpdateField(car.id, 'skinUrl', e.target.value)}
                placeholder={t.pasteLink}
                className="w-full bg-[#0a0f1d] border border-slate-700 rounded px-2.5 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* Driver Slots */}
      <div className="bg-[#0a0f1d]/80 border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            {t.assignedDrivers}{' '}
            {currentLeagueObj ? `(${currentLeagueObj.title})` : car.leagueId ? t.assignedLeague : t.general}
          </label>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
            {t.maxDriversPerCar.replace('{n}', String(maxSlots))}
          </span>
        </div>
        <div className={`grid gap-2 grid-cols-2 ${maxSlots > 2 ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
          {Array.from({ length: maxSlots }, (_, driverIdx) => {
            const currentVal = carDrivers[driverIdx] || ''
            return (
              <select
                key={driverIdx}
                value={currentVal}
                onChange={(e) => onUpdateDriver(car.id, currentLeagueKey, driverIdx, e.target.value)}
                className="w-full bg-[#131d31] border border-slate-700/70 focus:border-cyan-400 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer hover:border-slate-600 transition-all font-semibold"
              >
                <option value="">{t.vacantOption}</option>
                {teamMembers.map((m) => {
                  if (assignedDriverUserIds.has(m.userId) && m.userId !== currentVal) return null
                  return (
                    <option key={m.userId} value={m.userId}>
                      {m.name} {m.steamId ? `(${m.steamId})` : ''}
                    </option>
                  )
                })}
              </select>
            )
          })}
        </div>
      </div>
    </div>
  )
}
