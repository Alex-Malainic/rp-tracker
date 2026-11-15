import type { Segment } from '../components/ui'
import type { Locale } from './i18n'

/** For / against / abstained as bar segments in their status colours. */
export function tallySegments(
  t: Locale['t'],
  votesFor: number,
  against: number,
  abstained: number,
): Segment[] {
  return [
    { label: t('tally.for'), value: votesFor, className: 'bg-for' },
    { label: t('tally.against'), value: against, className: 'bg-against' },
    { label: t('tally.abstained'), value: abstained, className: 'bg-abstain' },
  ]
}
