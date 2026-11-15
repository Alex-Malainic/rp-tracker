import { partyStyle } from '../lib/parties'
import { useData } from '../lib/store'
import type { Member } from '../lib/types'
import { PartyDot } from './ui'

interface MixProps {
  members: Member[]
  /**
   * Name and count every party under the bar. Without it the bar is thicker
   * and relies on hovering a segment, so a shared <PartyLegend> must be in
   * view to say which colour is which party.
   */
  legend?: boolean
}

/** Which parties a set of members belongs to, as a split bar in party colours. */
export function PartyMix({ members, legend = true }: MixProps) {
  const { parties } = useData()
  const counts = new Map<number, number>()
  for (const member of members) {
    counts.set(member.party_id, (counts.get(member.party_id) ?? 0) + 1)
  }
  // Largest first; ties keep the app-wide party order.
  const shown = parties
    .filter((party) => counts.has(party.id))
    .map((party) => ({ party, count: counts.get(party.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  if (shown.length === 0) return <div className="h-2 rounded-full bg-sunken" />

  return (
    <div>
      <div
        className={`flex gap-0.5 ${legend ? 'h-2' : 'h-3.5'}`}
        role="img"
        aria-label={shown.map(({ party, count }) => `${party.abbreviation} ${count}`).join(', ')}
      >
        {shown.map(({ party, count }) => (
          <div
            key={party.id}
            style={{ ...partyStyle(party), flexGrow: count }}
            className="group/segment relative min-w-1 rounded-xs bg-(--party) first:rounded-l-full last:rounded-r-full hover:brightness-125"
          >
            {/* Appears at once on hover, unlike a native tooltip. */}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-2 py-1 text-xs font-medium text-ink shadow-lg shadow-black/20 group-hover/segment:flex">
              <span aria-hidden="true" className="size-2 rounded-xs bg-(--party)" />
              {party.abbreviation}
              <span className="tabular-nums text-ink-2">{count}</span>
            </span>
          </div>
        ))}
      </div>
      {legend && (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
          {shown.map(({ party, count }) => (
            <li key={party.id} style={partyStyle(party)} className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="size-2 rounded-xs bg-(--party)" />
              {party.abbreviation}
              <span className="font-medium tabular-nums text-ink">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** One shared key for the party colours: every party that has one of `members`. */
export function PartyLegend({ members, label }: { members: Member[]; label: string }) {
  const { parties } = useData()
  const present = new Set(members.map((member) => member.party_id))
  const shown = parties.filter((party) => present.has(party.id))
  if (shown.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm">
      {/* The label is for screen readers; on screen the dots speak for themselves. */}
      <ul aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1">
        {shown.map((party) => (
          <li key={party.id} className="inline-flex items-center gap-1.5 font-medium">
            <PartyDot party={party} />
            {party.abbreviation}
          </li>
        ))}
      </ul>
    </div>
  )
}
