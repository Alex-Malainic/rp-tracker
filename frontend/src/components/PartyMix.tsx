import { partyStyle } from '../lib/parties'
import { useData } from '../lib/store'
import type { Member } from '../lib/types'

/**
 * Which parties a set of members belongs to: a split bar in party colours,
 * with every party named and counted underneath so colour is never the only cue.
 */
export function PartyMix({ members, legend = true }: { members: Member[]; legend?: boolean }) {
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
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={shown.map(({ party, count }) => `${party.abbreviation} ${count}`).join(', ')}
      >
        {shown.map(({ party, count }) => (
          <div
            key={party.id}
            style={{ ...partyStyle(party), flexGrow: count }}
            className="rounded-xs bg-(--party)"
            title={`${party.abbreviation}: ${count}`}
          />
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
