import { useLocale } from '../lib/i18n'
import type { Party, SimilarityCell } from '../lib/types'
import { PartyDot } from './ui'

const TOP = 3

interface Pair {
  a: Party
  b: Party
  agreement: number
  votes: number
}

/**
 * The similarity grid in plain words: which groups vote together most often
 * and which least, so the answer does not have to be read out of the grid.
 */
export function PairInsights({ parties, cells }: { parties: Party[]; cells: SimilarityCell[] }) {
  const { t } = useLocale()
  const byId = new Map(parties.map((party) => [party.id, party]))

  // The grid stores both orderings of a pair; keep one of each.
  const pairs: Pair[] = []
  for (const cell of cells) {
    const a = byId.get(cell.party_a)
    const b = byId.get(cell.party_b)
    if (a && b && cell.party_a < cell.party_b) {
      pairs.push({ a, b, agreement: cell.agreement, votes: cell.votes })
    }
  }
  if (pairs.length === 0) return null
  pairs.sort((x, y) => y.agreement - x.agreement)

  // With few pairs, split them so none appears in both lists.
  const closest = pairs.slice(0, Math.min(TOP, Math.ceil(pairs.length / 2)))
  const furthest = pairs
    .slice(pairs.length - Math.min(TOP, Math.floor(pairs.length / 2)))
    .reverse()

  return (
    <div className="grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      <PairList title={t('pairs.closest')} pairs={closest} />
      {furthest.length > 0 && <PairList title={t('pairs.furthest')} pairs={furthest} />}
    </div>
  )
}

function PairList({ title, pairs }: { title: string; pairs: Pair[] }) {
  const { t, percent } = useLocale()
  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      <ul className="mt-2 flex flex-col gap-3">
        {pairs.map((pair) => (
          <li
            key={`${pair.a.id}:${pair.b.id}`}
            title={t('party.likeRow', { percent: percent(pair.agreement), n: pair.votes })}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-medium">
                <PartyDot party={pair.a} />
                <a href={`#/parties/${pair.a.id}`} className="hover:underline">
                  {pair.a.abbreviation}
                </a>
                <span className="text-ink-3">{t('pairs.and')}</span>
                <PartyDot party={pair.b} />
                <a href={`#/parties/${pair.b.id}`} className="hover:underline">
                  {pair.b.abbreviation}
                </a>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{percent(pair.agreement)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="bg-brand h-full rounded-full" style={{ width: `${pair.agreement * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
