import { CHOICE_LABELS } from '../lib/format'
import type { Choice, Result } from '../lib/types'

const CHOICE_ICONS: Record<Choice, string> = {
  for: '✓',
  against: '✕',
  abstain: '○',
  not_voted: '–',
}

/** A choice as icon plus label, so it never depends on colour alone. */
export function ChoiceBadge({ choice }: { choice: Choice }) {
  return (
    <span className={`badge badge-${choice}`}>
      <span aria-hidden="true">{CHOICE_ICONS[choice]}</span> {CHOICE_LABELS[choice]}
    </span>
  )
}

export function ResultBadge({ result }: { result: Result }) {
  const carried = result === 'passed'
  return (
    <span className={`badge badge-${carried ? 'for' : 'against'}`}>
      <span aria-hidden="true">{carried ? '✓' : '✕'}</span> {carried ? 'Carried' : 'Not carried'}
    </span>
  )
}
