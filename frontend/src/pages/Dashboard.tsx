import { useState } from 'react'
import { Heatmap } from '../components/Heatmap'
import { Sparkline } from '../components/Sparkline'
import { AsyncView, Card, PageHeader, PartyDot, SectionTitle, SplitBar, Stat } from '../components/ui'
import { fetchLatestSimilarity, fetchVotePage, type VotePage } from '../lib/api'
import { formatDate, formatDelta, formatMonth, formatPercent } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { isBloc, partyStyle } from '../lib/parties'
import { tallySegments } from '../lib/tally'
import { useData, useFilters, useVisibleParties } from '../lib/store'
import type { Party, SimilarityCell } from '../lib/types'

/** With no party picked in the sidebar, show only this many widgets. */
const DEFAULT_WIDGETS = 3

export function Dashboard() {
  const { members, cohesionByParty } = useData()
  const { finalOnly, selected } = useFilters()
  const visible = useVisibleParties()
  const [showAll, setShowAll] = useState(false)

  // Parties arrive largest first. Until the visitor picks some, or asks for
  // all, the page opens on the three largest real groups.
  const canCollapse = selected.size === 0 && visible.length > DEFAULT_WIDGETS
  const widgets =
    canCollapse && !showAll ? visible.filter(isBloc).slice(0, DEFAULT_WIDGETS) : visible

  const recent = useAsync(() => fetchVotePage(0, finalOnly), [finalOnly])
  const similarity = useAsync(fetchLatestSimilarity, [])

  // One shared scale, so every widget's sparkline can be compared.
  const all = [...cohesionByParty.values()].flat().map((point) => point.cohesion)
  const floor = all.length ? Math.max(0, Math.floor(Math.min(...all) * 20) / 20) : 0

  const votes = recent.status === 'ready' ? recent.data : null
  const cells = similarity.status === 'ready' ? similarity.data.cells : []
  const shownMembers = widgets.reduce(
    (sum, party) => sum + members.filter((member) => member.party_id === party.id).length,
    0,
  )

  return (
    <>
      <PageHeader
        title="Parties at a glance"
        lede="One widget per parliamentary group: how united it votes, where it stood on recent votes and who it votes most like. The three largest are shown first; pick others in the sidebar."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Parties shown"
          value={widgets.length}
          detail={`of ${visible.length}${selected.size > 0 ? ' selected' : ''}`}
          icon="◧"
        />
        <Stat label="Members" value={shownMembers} detail="in the parties shown" icon="☺" />
        <Stat
          icon="◷"
          label="Latest sitting"
          value={votes?.votes[0] ? formatDate(votes.votes[0].sitting_date) : '–'}
        />
        <Stat
          icon="☰"
          label="Recent votes compared"
          value={votes ? votes.votes.length : '–'}
          detail={finalOnly ? 'final votes only' : 'all votes'}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {widgets.map((party) => (
          <PartyWidget key={party.id} party={party} floor={floor} votes={votes} cells={cells} />
        ))}
      </div>
      {canCollapse && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="cursor-pointer rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium text-accent shadow-sm hover:bg-accent-soft"
          >
            {showAll ? 'Show only the three largest' : `Show all ${visible.length} parties`}
          </button>
        </div>
      )}

      <SectionTitle
        note={
          <>
            The percentage of votes
            {similarity.status === 'ready' && similarity.data.year
              ? ` in ${similarity.data.year}`
              : ''}{' '}
            on which two groups took the same majority position. The more a cell stands out from
            the page, the more often the two voted alike. Hover a cell for the number of votes.
          </>
        }
      >
        Who votes with whom
      </SectionTitle>
      <Card className="p-4">
        <AsyncView state={similarity}>
          {(data) => <Heatmap parties={visible.filter(isBloc)} cells={data.cells} />}
        </AsyncView>
      </Card>
    </>
  )
}

interface WidgetProps {
  party: Party
  floor: number
  votes: VotePage | null
  cells: SimilarityCell[]
}

function PartyWidget({ party, floor, votes, cells }: WidgetProps) {
  const { membersByParty, cohesionByParty, partyById } = useData()
  const points = cohesionByParty.get(party.id) ?? []
  const latest = points.at(-1)
  const previous = points.at(-2)
  const bloc = isBloc(party)

  // Where the group stood on the recent votes.
  const counts = { for: 0, against: 0, abstain: 0 }
  for (const vote of votes?.votes ?? []) {
    const position = votes?.positions.get(vote.id)?.get(party.id)
    if (position) counts[position.position] += 1
  }

  const others = cells
    .filter((cell) => cell.party_a === party.id && partyById.get(cell.party_b)?.abbreviation !== 'Neafiliati')
    .sort((a, b) => b.agreement - a.agreement)
  const closest = others[0]
  const furthest = others.length > 1 ? others.at(-1) : undefined

  return (
    <Card className="flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/10">
      <div style={partyStyle(party)} className="h-1.5 bg-(--party)" />
      <div className="party-wash flex grow flex-col gap-4 p-5" style={partyStyle(party)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={`#/parties/${party.id}`}
              className="flex items-center gap-2 text-lg font-semibold tracking-tight hover:underline"
            >
              <PartyDot party={party} />
              {party.abbreviation}
            </a>
            {party.name !== party.abbreviation && (
              <div className="truncate text-sm text-ink-2">{party.name}</div>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs font-medium text-ink-2">
            {membersByParty.get(party.id)?.length ?? 0} members
          </span>
        </div>

        {bloc ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-3">Cohesion</span>
              {latest && <span className="text-xs text-ink-3">{formatMonth(latest.month)}</span>}
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">
                {latest ? formatPercent(latest.cohesion) : '–'}
              </span>
              {latest && previous && (
                <span className="text-sm tabular-nums text-ink-2">
                  {formatDelta(latest.cohesion - previous.cohesion)} on the month before
                </span>
              )}
            </div>
            <Sparkline
              values={points.map((point) => point.cohesion)}
              floor={floor}
              label={`${party.abbreviation} cohesion by month`}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            Unaffiliated members do not vote as a bloc, so cohesion is not shown.
          </p>
        )}

        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
            Position on recent votes
          </div>
          <SplitBar segments={tallySegments(counts.for, counts.against, counts.abstain)} />
        </div>

        {bloc && closest && (
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
            <Ally label="Votes most like" cell={closest} />
            {furthest && <Ally label="Least like" cell={furthest} />}
          </dl>
        )}
      </div>
    </Card>
  )
}

function Ally({ label, cell }: { label: string; cell: SimilarityCell }) {
  const { partyById } = useData()
  const other = partyById.get(cell.party_b)
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
        <PartyDot party={other} />
        <a href={`#/parties/${cell.party_b}`} className="hover:underline">
          {other?.abbreviation}
        </a>
        <span className="tabular-nums text-ink-2">{formatPercent(cell.agreement)}</span>
      </dd>
    </div>
  )
}
