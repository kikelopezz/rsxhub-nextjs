'use client'

import { useFormStatus } from 'react-dom'
import { Plus, ShieldAlert, AlertTriangle, Loader2, Save } from 'lucide-react'
import type { CarEntry, TeamMemberOption, TakenDorsal, LeagueOption } from './types'
import { useCarEditor } from './use-car-editor'
import { CarLeagueTabs } from './car-league-tabs'
import { CarCard, categoryThemes } from './car-card'
import { useDictionary } from '@/lib/i18n/locale-provider'

export type { CarEntry, TeamMemberOption, TakenDorsal, LeagueOption }
export { getSkinFileName } from './types'

// ─── TeamCarsEditor ───────────────────────────────────────────────────────────

export function TeamCarsEditor({
  teamMembers,
  initialCars = [],
  takenDorsals = [],
  leaguesOptions = [],
  currentTeamId = '',
}: {
  teamMembers: TeamMemberOption[]
  initialCars: CarEntry[]
  takenDorsals?: TakenDorsal[]
  leaguesOptions?: LeagueOption[]
  currentTeamId?: string
}) {
  const {
    cars,
    setCars,
    activeTab,
    setActiveTab,
    carValidation,
    hasErrors,
    serialized,
    filteredCars,
    availableCategories,
    assignedDriverUserIds,
    uploadingCarId,
    addCar,
    removeCar,
    updateCarField,
    updateCarDriver,
    updateCarReserveDriver,
    getCarDriversForLeague,
    getCarReserveDriversForLeague,
    handleSkinFileUpload,
  } = useCarEditor({ initialCars, leaguesOptions, takenDorsals, currentTeamId })
  const t = useDictionary().equipos.carEditor

  return (
    <div className="space-y-6">
      <input type="hidden" name="teamCarsJson" value={serialized} />

      <CarLeagueTabs
        cars={cars}
        leaguesOptions={leaguesOptions}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {hasErrors && (
        <div className="bg-rose-950/40 border border-rose-500/50 p-4 rounded-lg flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-rose-200">
            <p className="font-bold">{t.completeFieldsAlert}</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {Object.entries(carValidation)
                .flatMap(([_, errs]) => errs)
                .map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {availableCategories.map((category) => {
        const categoryCars = filteredCars.filter((c) => c.category === category)
        const theme = categoryThemes[category]

        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className={`text-sm ${theme.headerText} flex items-center gap-2`}>
                <span className={`px-2 py-0.5 rounded text-xs border ${theme.badge}`}>
                  {category} CATEGORY
                </span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {categoryCars.length} {t.vehicles}
              </span>
            </div>

            {categoryCars.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 pl-2">
                {t.noVehiclesInView.replace('{category}', category)}
              </p>
            ) : (
              <div className="space-y-4">
                {categoryCars.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    carErrors={carValidation[car.id]}
                    activeTab={activeTab}
                    leaguesOptions={leaguesOptions}
                    teamMembers={teamMembers}
                    assignedDriverUserIds={assignedDriverUserIds}
                    uploadingCarId={uploadingCarId}
                    onRemove={removeCar}
                    onUpdateField={updateCarField}
                    onUpdateModel={(carId, name, acFolder, categ) =>
                      setCars((prev) =>
                        prev.map((c) =>
                          c.id === carId
                            ? { ...c, modelName: name, modelFolder: acFolder, category: categ as any }
                            : c,
                        ),
                      )
                    }
                    onUpdateDriver={updateCarDriver}
                    onUpdateReserveDriver={updateCarReserveDriver}
                    onSkinUpload={handleSkinFileUpload}
                    onSkinClear={(carId) =>
                      setCars((prev) =>
                        prev.map((c) => (c.id === carId ? { ...c, skinUrl: '', skinName: '' } : c)),
                      )
                    }
                    getCarDriversForLeague={getCarDriversForLeague}
                    getCarReserveDriversForLeague={getCarReserveDriversForLeague}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => addCar(category, activeTab === 'all' ? null : activeTab)}
              className="w-full py-2.5 px-4 rounded-lg border border-dashed border-slate-700 hover:border-emerald-500/60 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {t.addVehicle.replace('{category}', category)}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── SaveTeamCarsButton ───────────────────────────────────────────────────────

export function SaveTeamCarsButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus()
  const t = useDictionary().equipos.carEditor
  const isBlocked = pending || disabled

  return (
    <div className="w-full space-y-2 pt-4 border-t border-shell-line/50">
      {pending && (
        <div className="w-full bg-slate-900 h-2 overflow-hidden rounded-lg border border-cyan-500/40 relative">
          <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-300 animate-pulse w-full shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {pending ? (
          <span className="text-xs text-cyan-400 font-mono font-bold animate-pulse flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.synchronizing}
          </span>
        ) : disabled ? (
          <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            {t.completeFieldsHint}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">
            {t.makeSureToSave}
          </span>
        )}
        <button
          type="submit"
          disabled={isBlocked}
          className={`px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white rounded-lg transition-all flex items-center gap-2 ${
            isBlocked
              ? 'bg-slate-800 border border-slate-700 text-slate-500 opacity-60 cursor-not-allowed'
              : 'bg-shell-accent hover:bg-red-700 shadow-lg cursor-pointer'
          }`}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span>{t.saving}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{t.saveChanges}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
