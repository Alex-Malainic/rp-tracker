import type { Choice } from './types'

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const percentFormat = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 })

/** Format an ISO date ("2026-11-10") without shifting it across time zones. */
export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`))
export const formatMonth = (iso: string) => monthFormat.format(new Date(`${iso}T00:00:00Z`))
export const formatPercent = (share: number) => percentFormat.format(share)

export const CHOICE_LABELS: Record<Choice, string> = {
  for: 'For',
  against: 'Against',
  abstain: 'Abstained',
  not_voted: 'Did not vote',
}

// Sequential blue ramp, lightest to darkest. On a dark surface it is read in
// reverse so that "near zero" still recedes into the background.
const RAMP = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
]

/** Fill and ink for a heatmap cell holding a share between 0 and 1. */
export function heatColors(share: number, dark: boolean): { background: string; color: string } {
  const step = Math.min(RAMP.length - 1, Math.max(0, Math.round(share * (RAMP.length - 1))))
  const index = dark ? RAMP.length - 1 - step : step
  return { background: RAMP[index], color: index >= 6 ? '#ffffff' : '#0b0b0b' }
}

/** Lower-case and strip diacritics, so "tusa" finds "Tuşa". */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** A change between two shares, in percentage points: "+1.2 pts". */
export function formatDelta(change: number): string {
  const points = change * 100
  const sign = points > 0 ? '+' : points < 0 ? '−' : '±'
  return `${sign}${Math.abs(points).toFixed(1)} pts`
}
