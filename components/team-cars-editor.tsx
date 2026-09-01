/**
 * Re-export shim — the implementation has been split into:
 *   components/team-cars-editor/index.tsx         (assembly)
 *   components/team-cars-editor/use-car-editor.ts  (state & logic hook)
 *   components/team-cars-editor/car-card.tsx       (single vehicle card UI)
 *   components/team-cars-editor/car-league-tabs.tsx (league filter tabs UI)
 *   components/team-cars-editor/car-validation.ts  (validation logic)
 *   components/team-cars-editor/car-skin-upload.ts (skin upload tiers)
 *   components/team-cars-editor/types.ts            (shared types)
 *
 * All external imports from '@/components/team-cars-editor' continue to work.
 */
export {
  TeamCarsEditor,
  SaveTeamCarsButton,
  getSkinFileName,
} from './team-cars-editor/index'

export type {
  CarEntry,
  TeamMemberOption,
  TakenDorsal,
  LeagueOption,
} from './team-cars-editor/types'
