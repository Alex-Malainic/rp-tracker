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
