import type { CSSProperties } from 'react'
import type { Party } from './types'

/**
 * A fixed colour per group, as [light theme, dark theme]. The colour belongs
 * to the group and never changes with filters or ordering.
 *
 * Eight hues cannot all be told apart by every reader, so colour is only ever
 * an accent beside the group's name, never the sole way to identify it.
 * Groups without an entry share a neutral grey.
 */
const COLORS: Record<string, [string, string]> = {
  PSD: ['#e34948', '#e66767'],
  PNL: ['#eda100', '#c98500'],
  USR: ['#2a78d6', '#3987e5'],
  AUR: ['#eb6834', '#d95926'],
  UDMR: ['#008300', '#0ca30c'],
  'SOS RO': ['#6250d6', '#9085e9'],
  POT: ['#e87ba4', '#d55181'],
  Minoritati: ['#1baf7a', '#199e70'],
}
const NEUTRAL: [string, string] = ['#8a8983', '#8a8983']

/** Not a bloc: its members do not vote together, so cohesion means nothing. */
export const isBloc = (party: Party) => party.abbreviation !== 'Neafiliati'

/** Inline style that exposes the group's colour as the CSS variable --party. */
export function partyStyle(party: Party | undefined): CSSProperties {
  const [light, dark] = (party && COLORS[party.abbreviation]) ?? NEUTRAL
  return { '--party': `light-dark(${light}, ${dark})` } as CSSProperties
}
