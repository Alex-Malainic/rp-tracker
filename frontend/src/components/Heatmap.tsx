import { heatColors } from '../lib/format'
import { usePrefersDark } from '../lib/hooks'
import { useLocale } from '../lib/i18n'
import type { Party, SimilarityCell } from '../lib/types'
import { Notice, PartyDot } from './ui'

/** How often each pair of groups took the same position, as a labelled grid. */
export function Heatmap({ parties, cells }: { parties: Party[]; cells: SimilarityCell[] }) {
  const { t, percent } = useLocale()
  const dark = usePrefersDark()
  const lookup = new Map(cells.map((cell) => [`${cell.party_a}:${cell.party_b}`, cell]))
  const present = new Set(cells.map((cell) => cell.party_a))
  const shown = parties.filter((party) => present.has(party.id))
  if (shown.length < 2) return <Notice>{t('heatmap.need')}</Notice>

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <td />
            {shown.map((party) => (
              <th key={party.id} scope="col" className="px-1 pb-1 font-semibold text-ink-2">
                {party.abbreviation}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="pr-2 text-right font-semibold text-ink-2">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <PartyDot party={row} />
                  {row.abbreviation}
                </span>
              </th>
              {shown.map((column) => {
                const cell = lookup.get(`${row.id}:${column.id}`)
                if (!cell) return <td key={column.id} className="rounded-md bg-sunken" />
                return (
                  <td
                    key={column.id}
                    style={heatColors(cell.agreement, dark)}
                    className="h-9 min-w-12 rounded-md text-center font-medium tabular-nums"
                    title={t('heatmap.cell', {
                      a: row.abbreviation,
                      b: column.abbreviation,
                      percent: percent(cell.agreement),
                      n: cell.votes,
                    })}
                  >
                    {Math.round(cell.agreement * 100)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
