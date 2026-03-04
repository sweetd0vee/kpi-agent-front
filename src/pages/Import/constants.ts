export type SlotTypeId =
  | 'business_plan_checklist'
  | 'strategy_checklist'
  | 'reglament_checklist'
  | 'department_goals_checklist'
  | 'chairman_goals'

export const SLOT_TYPES: { id: SlotTypeId; label: string }[] = [
  { id: 'business_plan_checklist', label: 'Бизнес-план' },
  { id: 'strategy_checklist', label: 'Стратегия' },
  { id: 'reglament_checklist', label: 'Регламент' },
  { id: 'department_goals_checklist', label: 'Положение о департаменте' },
  { id: 'chairman_goals', label: 'Свои цели' },
]

export const TEMPLATE_SLOT_IDS: SlotTypeId[] = [
  'business_plan_checklist',
  'strategy_checklist',
  'reglament_checklist',
]

export function createInitialFiles(): Record<SlotTypeId, File | null> {
  return {
    business_plan_checklist: null,
    strategy_checklist: null,
    reglament_checklist: null,
    department_goals_checklist: null,
    chairman_goals: null,
  }
}
