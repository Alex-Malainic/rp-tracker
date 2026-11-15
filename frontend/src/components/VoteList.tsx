import { formatDate } from '../lib/format'
import { partyStyle } from '../lib/parties'
import { tallySegments } from '../lib/tally'
import type { VotePage } from '../lib/api'
import type { Party, Vote } from '../lib/types'
import { Card, ChoiceBadge, Notice, ResultBadge, SplitBar } from './ui'

const CHAMBER_LABELS = { deputies: 'Chamber', senate: 'Senate', joint: 'Joint sitting' }

/** Votes as rows, each with its tally and the position of the given groups. */
export function VoteList({ page, parties }: { page: VotePage; parties: Party[] }) {
  if (page.votes.length === 0) return <Notice>No votes to show.</Notice>
  return (
    <Card className="divide-y divide-line">
      {page.votes.map((vote) => (
        <VoteRow key={vote.id} vote={vote} parties={parties} positions={page.positions.get(vote.id)} />
      ))}
    </Card>
  )
}

interface RowProps {
  vote: Vote
  parties: Party[]
  positions: VotePage['positions'] extends Map<number, infer P> ? P | undefined : never
}

function VoteRow({ vote, parties, positions }: RowProps) {
  return (
    <article className="grid gap-x-6 gap-y-3 p-4 lg:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <time dateTime={vote.sitting_date}>{formatDate(vote.sitting_date)}</time>
          <span aria-hidden="true">·</span>
          <span>{CHAMBER_LABELS[vote.chamber]}</span>
          {vote.is_final && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
              Final vote
            </span>
          )}
        </div>
        <h3 className="mt-1 font-medium leading-snug">
          <a href={vote.source_url} target="_blank" rel="noreferrer" className="hover:underline">
            {vote.bill_title ?? vote.title}
          </a>
        </h3>
        {vote.bill_title && (
          <p className="mt-0.5 text-sm text-ink-2">
            {vote.title}
            {vote.bill_url && (
              <>
                {' · '}
                <a
                  href={vote.bill_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Bill page
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
                      ? `${party.abbreviation}: ${position.agreeing} of ${position.voters} voted this way`
                      : `${party.abbreviation}: no votes cast`
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-line border-l-4 border-l-(--party) py-0.5 pl-2 pr-2.5 text-xs font-medium"
                >
                  {party.abbreviation}
                  {position ? (
                    <ChoiceBadge choice={position.position} short />
                  ) : (
                    <span className="text-ink-3">n/a</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        <ResultBadge result={vote.result} />
        <div className="w-full">
          <SplitBar segments={tallySegments(vote.votes_for, vote.votes_against, vote.abstained)} />
        </div>
      </div>
    </article>
  )
}
