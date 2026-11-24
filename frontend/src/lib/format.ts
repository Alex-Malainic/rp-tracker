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
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// How often two groups vote alike, as a two-sided scale: red when they mostly
// vote apart, grey around 50% (no more alike than chance), blue when they mostly
// vote together. Index 0 is 0%, index 10 is 100%. Computed in OKLab from the
// palette's blue and its red at equal lightness, so neither side looks heavier;
// on a dark surface the stronger colours are the lighter ones.
const AGREEMENT: Record<'light' | 'dark', string[]> = {
  light: [
    '#9a0217', '#b04642', '#c4726b', '#d69b94', '#e4c5bf', '#f0efec',
    '#c3cedc', '#98aecb', '#6e8eba', '#456fa8', '#184f95',
  ],
  dark: [
    '#ff8c89', '#d47b77', '#ab6a66', '#835955', '#5d4945', '#383835',
    '#474f57', '#57687a', '#6681a0', '#769bc7', '#86b6ef',
  ],
}
// Steps whose number reads better in white than in near-black.
const WHITE_INK: Record<'light' | 'dark', Set<number>> = {
  light: new Set([0, 1, 9, 10]),
  dark: new Set([3, 4, 5, 6, 7]),
}

/** The scale's steps, from "always apart" to "always together". */
export const agreementSteps = (dark: boolean) => AGREEMENT[dark ? 'dark' : 'light']

/** Fill and ink for a cell holding how often two groups voted alike (0 to 1). */
export function agreementColors(share: number, dark: boolean): { background: string; color: string } {
  const mode = dark ? 'dark' : 'light'
  const step = Math.min(10, Math.max(0, Math.round(share * 10)))
  return {
    background: AGREEMENT[mode][step],
    color: WHITE_INK[mode].has(step) ? '#ffffff' : '#0b0b0b',
  }
}
