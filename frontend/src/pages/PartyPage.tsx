import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AsyncView, Card, Notice, PageHeader, PartyDot, SectionTitle, Stat } from '../components/ui'
import { VoteList } from '../components/VoteList'
import { fetchLatestSimilarity, fetchVotePage } from '../lib/api'
import { formatMonth, formatPercent } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { isBloc, partyStyle } from '../lib/parties'
import { useData, useFilters } from '../lib/store'
import type { CohesionPoint } from '../lib/types'

const ROLE_LABELS = { deputies: 'Deputy', senate: 'Senator' }

/** Everything about one group: cohesion, allies, members and recent votes. */
export default function PartyPage({ id }: { id: number }) {
  const { partyById, membersByParty, cohesionByParty } = useData()
  const { finalOnly } = useFilters()
  const party = partyById.get(id)

  const similarity = useAsync(fetchLatestSimilarity, [])
  const votes = useAsync(() => fetchVotePage(0, finalOnly), [finalOnly])

  if (!party) return <Notice>No such party.</Notice>

  const members = membersByParty.get(id) ?? []
  const points = cohesionByParty.get(id) ?? []
  const latest = points.at(-1)
  const bloc = isBloc(party)

  return (
    <div style={partyStyle(party)}>
      <a href="#/" className="text-sm text-accent hover:underline">
        ← All parties
      </a>
      <div className="mt-3 flex items-center gap-3">
        <span className="h-10 w-1.5 rounded-full bg-(--party)" aria-hidden="true" />
        <PageHeader title={party.abbreviation} lede={party.name !== party.abbreviation ? party.name : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Members" value={members.length} detail="current legislature" />
        <Stat
          label="Deputies / senators"
          value={`${members.filter((member) => member.chamber === 'deputies').length} / ${members.filter((member) => member.chamber === 'senate').length}`}
        />
        {bloc && (
          <Stat
            label="Cohesion"
            value={latest ? formatPercent(latest.cohesion) : '–'}
            detail={latest ? `${formatMonth(latest.month)}, ${latest.votes} votes` : undefined}
          />
        )}
      </div>

      {bloc && (
        <>
          <SectionTitle note="Of the votes its members cast each month, the share that matched the group’s majority position.">
            Cohesion over time
          </SectionTitle>
          <Card className="p-4">
            {points.length < 2 ? (
              <Notice>Not enough data yet.</Notice>
            ) : (
              <CohesionChart points={points} />
            )}
          </Card>

          <SectionTitle note="The share of votes on which this group and another took the same majority position.">
            Votes most like
          </SectionTitle>
          <Card className="p-4">
            <AsyncView state={similarity}>
              {({ cells }) => {
                const rows = cells
                  .filter((cell) => cell.party_a === id && partyById.has(cell.party_b))
                  .sort((a, b) => b.agreement - a.agreement)
                if (rows.length === 0) return <Notice>No comparison data yet.</Notice>
                return (
                  <ul className="flex flex-col gap-2.5">
                    {rows.map((cell) => {
                      const other = partyById.get(cell.party_b)
                      return (
                        <li
                          key={cell.party_b}
                          className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3 text-sm"
                          title={`Same position on ${formatPercent(cell.agreement)} of ${cell.votes} votes`}
                        >
                          <a
                            href={`#/parties/${cell.party_b}`}
                            className="flex items-center gap-2 font-medium hover:underline"
                          >
                            <PartyDot party={other} />
                            <span className="truncate">{other?.abbreviation}</span>
                          </a>
                          <div className="h-2 overflow-hidden rounded-full bg-sunken">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${cell.agreement * 100}%` }}
                            />
                          </div>
                          <span className="text-right tabular-nums text-ink-2">
                            {formatPercent(cell.agreement)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )
              }}
            </AsyncView>
          </Card>
        </>
      )}

      <SectionTitle note="The chip on each vote shows how the majority of this group voted.">
        Recent votes
      </SectionTitle>
      <AsyncView state={votes}>{(data) => <VoteList page={data} parties={[party]} />}</AsyncView>

      <SectionTitle>Members</SectionTitle>
      {members.length === 0 ? (
        <Notice>No members in the current legislature.</Notice>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <li key={member.id}>
              <a
                href={`#/members/${member.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm hover:border-accent"
              >
                <span className="truncate font-medium">{member.name}</span>
                <span className="shrink-0 text-xs text-ink-3">{ROLE_LABELS[member.chamber]}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CohesionChart({ points }: { points: CohesionPoint[] }) {
  const lowest = Math.min(...points.map((point) => point.cohesion))
  const floor = Math.max(0, Math.floor(lowest * 20) / 20 - 0.05)
  const axis = { fill: 'var(--color-ink-3)', fontSize: 12 }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={axis}
          stroke="var(--color-line)"
          minTickGap={48}
        />
        <YAxis
          domain={[floor, 1]}
          tickFormatter={formatPercent}
          tick={axis}
          stroke="var(--color-line)"
          width={48}
        />
        <Tooltip
          cursor={{ stroke: 'var(--color-ink-3)' }}
          contentStyle={{
            background: 'var(--color-panel)',
            border: '1px solid var(--color-line)',
            borderRadius: 12,
            color: 'var(--color-ink)',
          }}
          labelFormatter={(month) => formatMonth(String(month))}
          formatter={(value, _name, item) => [
            `${formatPercent(Number(value))} over ${(item.payload as CohesionPoint).votes} votes`,
            'Cohesion',
          ]}
        />
        <Line
          type="monotone"
          dataKey="cohesion"
          stroke="var(--party)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
