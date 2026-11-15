import type { Segment } from '../components/ui'

/** For / against / abstained as bar segments in their status colours. */
export function tallySegments(votesFor: number, against: number, abstained: number): Segment[] {
  return [
    { label: 'for', value: votesFor, className: 'bg-for' },
    { label: 'against', value: against, className: 'bg-against' },
    { label: 'abstained', value: abstained, className: 'bg-abstain' },
  ]
}
