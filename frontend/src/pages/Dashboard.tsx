import { useState } from 'react'
import { Heatmap } from '../components/Heatmap'
import { Sparkline } from '../components/Sparkline'
import {
  AsyncView,
  Card,
  Help,
  PageHeader,
  PartyDot,
  SectionTitle,
  SplitBar,
  Stat,
} from '../components/ui'
import { fetchLatestSimilarity, fetchVotePage, type VotePage } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useLocale, type MessageKey } from '../lib/i18n'
import { isBloc, partyStyle } from '../lib/parties'
import { useData, useFilters, useVisibleParties } from '../lib/store'
import { tallySegments } from '../lib/tally'
import type { Party, SimilarityCell } from '../lib/types'

/** With no party picked in the sidebar, show only this many widgets. */
const DEFAULT_WIDGETS = 3

export function Dashboard() {
  const { t, date } = useLocale()
  const { membersByParty, cohesionByParty } = useData()
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
  const year = similarity.status === 'ready' ? similarity.data.year : null
  const shownMembers = widgets.reduce(
    (sum, party) => sum + (membersByParty.get(party.id)?.length ?? 0),
    0,
  )

  return (
    <>
      <PageHeader title={t('dash.title')} lede={t('dash.lede')} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          icon="◧"
          label={t('stat.partiesShown')}
          value={widgets.length}
          detail={t(selected.size > 0 ? 'stat.ofNSelected' : 'stat.ofN', { n: visible.length })}
        />
        <Stat
          icon="☺"
          label={t('stat.members')}
          value={shownMembers}
          detail={t('stat.membersDetail')}
        />
        <Stat
          icon="◷"
          label={t('stat.latestSitting')}
          value={votes?.votes[0] ? date(votes.votes[0].sitting_date) : '–'}
        />
        <Stat
          icon="☰"
          label={t('stat.recentVotes')}
          value={votes ? votes.votes.length : '–'}
          detail={t(finalOnly ? 'stat.finalOnly' : 'stat.allVotes')}
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
            {showAll ? t('dash.showThree') : t('dash.showAll', { n: visible.length })}
          </button>
        </div>
      )}

      <SectionTitle
        note={t('dash.similarityNote', { year: year ? t('dash.inYear', { year }) : '' })}
      >
        {t('dash.similarityTitle')}
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
  const { t, month, percent, delta } = useLocale()
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
    .filter((cell) => {
      const other = partyById.get(cell.party_b)
      return cell.party_a === party.id && other !== undefined && isBloc(other)
    })
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
            {t('widget.members', { n: membersByParty.get(party.id)?.length ?? 0 })}
          </span>
        </div>

        {bloc ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
                {t('widget.cohesion')}
                <Help label={t('help.cohesionLabel')}>{t('help.cohesion')}</Help>
              </span>
              {latest && <span className="text-xs text-ink-3">{month(latest.month)}</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">
                {latest ? percent(latest.cohesion) : '–'}
              </span>
              {latest && previous && (
                <span className="text-sm tabular-nums text-ink-2">
                  {t('widget.delta', { delta: delta(latest.cohesion - previous.cohesion) })}
                </span>
              )}
            </div>
            <Sparkline
              values={points.map((point) => point.cohesion)}
              floor={floor}
              label={t('spark.label', { party: party.abbreviation })}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-2">{t('widget.notBloc')}</p>
        )}

        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
            {t('widget.recentPositions')}
          </div>
          <SplitBar segments={tallySegments(t, counts.for, counts.against, counts.abstain)} />
        </div>

        {bloc && closest && (
          <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
            <Ally label="widget.mostLike" cell={closest} />
            {furthest && <Ally label="widget.leastLike" cell={furthest} />}
          </dl>
        )}
      </div>
    </Card>
  )
}

function Ally({ label, cell }: { label: MessageKey; cell: SimilarityCell }) {
  const { t, percent } = useLocale()
  const { partyById } = useData()
  const other = partyById.get(cell.party_b)
  return (
    <div>
      <dt className="text-xs text-ink-3">{t(label)}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
        <PartyDot party={other} />
        <a href={`#/parties/${cell.party_b}`} className="hover:underline">
          {other?.abbreviation}
        </a>
        <span className="tabular-nums text-ink-2">{percent(cell.agreement)}</span>
      </dd>
    </div>
  )
}
