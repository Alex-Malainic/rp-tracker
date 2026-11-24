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
// vote differently, a light neutral around 50% (no more alike than chance),
// green when they mostly vote together. Index 0 is 0%, index 10 is 100%.
//
// Built in OKLCH: each side keeps one hue all the way to the middle, so the
// steps never pass through muddy browns or greys. The two sides have equal
// lightness at equal distance from 50%, so neither looks heavier. The hues
// (red 30°, emerald 165°) were chosen so the two ends stay distinguishable for
// protanopia and deuteranopia (simulated, Machado et al. 2009); cells close to
// 50% may look alike to colour-blind readers, which is why every cell also
// shows its number.
const AGREEMENT: Record<'light' | 'dark', string[]> = {
  light: [
    '#ca0f01', '#e83c2a', '#f66e5b', '#ff9989', '#ffc4b9', '#f2f0ec',
    '#a6e4c8', '#5dd2a5', '#05ba87', '#059c71', '#027f5b',
  ],
  dark: [
    '#c40f01', '#da3929', '#dd6857', '#dd8e80', '#dab0a8', '#d3d1cb',
    '#9ec6b3', '#63ba96', '#06ab7c', '#03936a', '#017c59',
  ],
}
// Steps whose number reads better in white than in near-black.
const WHITE_INK: Record<'light' | 'dark', Set<number>> = {
  light: new Set([0, 10]),
  dark: new Set([0, 1, 10]),
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
