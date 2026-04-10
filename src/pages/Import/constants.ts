export type SlotTypeId =
  | 'reglament_checklist'
  | 'department_goals_checklist'
  | 'chairman_goals'

export const SLOT_TYPES: { id: SlotTypeId; label: string }[] = [
  { id: 'reglament_checklist', label: 'Регламент' },
  { id: 'department_goals_checklist', label: 'Положение о департаменте' },
  { id: 'chairman_goals', label: 'Свои цели' },
]

export const TEMPLATE_SLOT_IDS: SlotTypeId[] = ['reglament_checklist']

export function createInitialFiles(): Record<SlotTypeId, File | null> {
  return {
    reglament_checklist: null,
    department_goals_checklist: null,
    chairman_goals: null,
  }
}
