import type { VotePage } from '../lib/api'
import { useLocale } from '../lib/i18n'
import { partyStyle } from '../lib/parties'
import { tallySegments } from '../lib/tally'
import type { Party, PartyPosition, Tally, Vote } from '../lib/types'
import { Card, ChoiceBadge, Notice, ResultBadge, SplitBar } from './ui'

interface ListProps {
  page: VotePage
  /** Groups whose position is shown as a chip on each vote. */
  parties: Party[]
  /** A second tally per vote id, e.g. one region's, shown above the overall one. */
  extraTallies?: Map<number, Tally>
  extraLabel?: string
}

/** Votes as rows, each with its tally and the position of the given groups. */
export function VoteList({ page, parties, extraTallies, extraLabel }: ListProps) {
  const { t } = useLocale()
  if (page.votes.length === 0) return <Notice>{t('votes.none')}</Notice>
  return (
    <Card className="divide-y divide-line">
      {page.votes.map((vote) => (
        <VoteRow
          key={vote.id}
          vote={vote}
          parties={parties}
          positions={page.positions.get(vote.id)}
          extra={extraTallies?.get(vote.id)}
          extraLabel={extraTallies ? extraLabel : undefined}
        />
      ))}
    </Card>
  )
}

interface RowProps {
  vote: Vote
  parties: Party[]
  positions: Map<number, PartyPosition> | undefined
  extra: Tally | undefined
  extraLabel: string | undefined
}

function VoteRow({ vote, parties, positions, extra, extraLabel }: RowProps) {
  const { t, date } = useLocale()
  return (
    <article className="grid gap-x-6 gap-y-3 p-4 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <time dateTime={vote.sitting_date}>{date(vote.sitting_date)}</time>
          <span aria-hidden="true">·</span>
          <span>{t(`chamber.${vote.chamber}`)}</span>
          {vote.is_final && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
              {t('vote.final')}
            </span>
          )}
        </div>
        {/* Titles come from the source and stay in Romanian in both languages. */}
        <h3 lang="ro" className="mt-1 font-medium leading-snug">
          <a href={vote.source_url} target="_blank" rel="noreferrer" className="hover:underline">
            {vote.bill_title ?? vote.title}
          </a>
        </h3>
        {vote.bill_title && (
          <p className="mt-0.5 text-sm text-ink-2">
            <span lang="ro">{vote.title}</span>
            {vote.bill_url && (
              <>
                {' · '}
                <a
                  href={vote.bill_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {t('vote.billPage')}
                </a>
              </>
            )}
          </p>
        )}
        {parties.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {parties.map((party) => {
              const position = positions?.get(party.id)
              return (
                <li
                  key={party.id}
                  style={partyStyle(party)}
                  title={
                    position
                      ? t('chip.voted', {
                          party: party.abbreviation,
                          a: position.agreeing,
                          b: position.voters,
                        })
                      : t('chip.none', { party: party.abbreviation })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-line border-l-4 border-l-(--party) py-0.5 pl-2 pr-2.5 text-xs font-medium"
                >
                  {party.abbreviation}
                  {position ? (
                    <ChoiceBadge choice={position.position} short />
                  ) : (
                    <span className="text-ink-3">–</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        <ResultBadge result={vote.result} />
        {extraLabel !== undefined && (
          <div className="w-full">
            <div className="mb-1 text-xs font-medium text-ink-3">{extraLabel}</div>
            <SplitBar
              segments={tallySegments(
                t,
                extra?.votes_for ?? 0,
                extra?.votes_against ?? 0,
                extra?.abstained ?? 0,
              )}
            />
          </div>
        )}
        <div className="w-full">
          {extraLabel !== undefined && (
            <div className="mb-1 text-xs font-medium text-ink-3">{t('region.overall')}</div>
          )}
          <SplitBar
            segments={tallySegments(t, vote.votes_for, vote.votes_against, vote.abstained)}
          />
        </div>
      </div>
    </article>
  )
}
