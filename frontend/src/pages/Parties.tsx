import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AsyncView } from '../components/AsyncView'
import { fetchCohesion, fetchParties, fetchSimilarity, fetchSimilarityYears } from '../lib/api'
import { formatMonth, formatPercent, heatColors } from '../lib/format'
import { useAsync, usePrefersDark } from '../lib/hooks'
import type { CohesionPoint, Party, SimilarityCell } from '../lib/types'

// Not parties: their members do not vote as a bloc, so cohesion and
// similarity would describe nothing.
const NOT_A_BLOC = new Set(['Neafiliati'])

export function Parties() {
  const base = useAsync(async () => {
    const [parties, cohesion, years] = await Promise.all([
      fetchParties(),
      fetchCohesion(),
      fetchSimilarityYears(),
    ])
    return { parties: parties.filter((party) => !NOT_A_BLOC.has(party.abbreviation)), cohesion, years }
  }, [])

  return (
    <section>
      <h1>Parties</h1>
      <AsyncView state={base}>
        {({ parties, cohesion, years }) => (
          <>
            <Cohesion parties={parties} points={cohesion} />
            <Similarity parties={parties} years={years} />
          </>
        )}
      </AsyncView>
    </section>
  )
}

function Cohesion({ parties, points }: { parties: Party[]; points: CohesionPoint[] }) {
  const byParty = new Map<number, CohesionPoint[]>()
  for (const point of points) {
    byParty.set(point.party_id, [...(byParty.get(point.party_id) ?? []), point])
  }
  const shown = parties.filter((party) => byParty.has(party.id))
  if (shown.length === 0) return <p className="notice">No cohesion data yet.</p>

  // One shared scale, so the small charts can be compared at a glance.
  const lowest = Math.min(...points.map((point) => point.cohesion))
  const floor = Math.max(0, Math.floor(lowest * 10) / 10)

  return (
    <>
      <h2>Cohesion over time</h2>
      <p className="lede">
        Of the votes a group’s members cast each month, the share that matched the group’s majority
        position. All charts share the same scale.
      </p>
      <div className="multiples">
        {shown.map((party) => (
          <figure key={party.id} className="card">
            <figcaption>
              <strong>{party.abbreviation}</strong>
              {party.name !== party.abbreviation && <span className="muted"> {party.name}</span>}
            </figcaption>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart
                data={byParty.get(party.id)}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  stroke="var(--grid)"
                  minTickGap={40}
                />
                <YAxis
                  domain={[floor, 1]}
                  tickFormatter={formatPercent}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  stroke="var(--grid)"
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--text-muted)' }}
                  contentStyle={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
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
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </figure>
        ))}
      </div>
    </>
  )
}

function Similarity({ parties, years }: { parties: Party[]; years: number[] }) {
  const [year, setYear] = useState(years[0])
  const cells = useAsync(
    () => (year === undefined ? Promise.resolve([]) : fetchSimilarity(year)),
    [year],
  )
  if (year === undefined) return null

  return (
    <>
      <h2>How often parties vote alike</h2>
      <p className="lede">
        The percentage of votes on which two groups took the same majority position. The more a
        cell stands out from the page, the more often the two voted alike.
      </p>
      <div className="filters">
        <label>
          Year{' '}
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <AsyncView state={cells}>
        {(data) => <Heatmap parties={parties} cells={data} />}
      </AsyncView>
    </>
  )
}

function Heatmap({ parties, cells }: { parties: Party[]; cells: SimilarityCell[] }) {
  const dark = usePrefersDark()
  const lookup = new Map(cells.map((cell) => [`${cell.party_a}:${cell.party_b}`, cell]))
  const present = new Set(cells.map((cell) => cell.party_a))
  const shown = parties.filter((party) => present.has(party.id))
  if (shown.length === 0) return <p className="notice">No similarity data for this year.</p>

  return (
    <div className="table-scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <td />
            {shown.map((party) => (
              <th key={party.id} scope="col">
                {party.abbreviation}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.abbreviation}</th>
              {shown.map((column) => {
                const cell = lookup.get(`${row.id}:${column.id}`)
                if (!cell) return <td key={column.id} className="heat-empty" />
                return (
                  <td
                    key={column.id}
                    className="heat-cell"
                    style={heatColors(cell.agreement, dark)}
                    title={`${row.abbreviation} and ${column.abbreviation}: same position on ${formatPercent(cell.agreement)} of ${cell.votes} votes`}
                  >
                    {Math.round(cell.agreement * 100)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="footnote">Hover a cell for the number of votes compared.</p>
    </div>
  )
}
