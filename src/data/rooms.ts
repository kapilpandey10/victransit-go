/**
 * Hadfield Early Learning Centre — rooms, in display order.
 * Used by the Weekly Wrap-Up tool (signature: "The <Room> Team").
 */
export const ROOMS = [
  'Blossoms',
  'Sweet Peas',
  'Chamomiles',
  'Dandelions',
  'Butter Beans',
  'Rosellas',
  'Wattles',
] as const

export type RoomName = (typeof ROOMS)[number]

/** Sign-off used in generated wrap-ups, e.g. "The Chamomiles Team". */
export function roomTeam(room: string): string {
  return `The ${room} Team`
}

/** Title used in generated wrap-ups, e.g. "Chamomiles Room – Weekly Wrap-Up". */
export function roomTitle(room: string): string {
  return `${room} Room – Weekly Wrap-Up`
}