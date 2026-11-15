import { useState } from 'react'
import { AsyncView } from '../components/AsyncView'
import { ChoiceBadge, ResultBadge } from '../components/Badges'
import { fetchParties, fetchPositions, fetchVotes, PAGE_SIZE } from '../lib/api'
import { formatDate, formatPercent } from '../lib/format'
import { useAsync } from '../lib/hooks'
import type { PartyPosition, Vote } from '../lib/types'

const CHAMBER_LABELS = { deputies: 'Chamber', senate: 'Senate', joint: 'Joint sitting' }

export function Overview() {
  const [finalOnly, setFinalOnly] = useState(true)
  const [partyId, setPartyId] = useState<number | undefined>()
  const [page, setPage] = useState(0)

  const parties = useAsync(fetchParties, [])
  const votes = useAsync(async () => {
    const found = await fetchVotes(page, finalOnly)
    const positions =
      partyId === undefined
        ? []
        : await fetchPositions(
            found.map((vote) => vote.id),
            partyId,
          )
    return { votes: found, positions: new Map(positions.map((p) => [p.vote_id, p])) }
  }, [page, finalOnly, partyId])

  const party =
    parties.status === 'ready' ? parties.data.find((item) => item.id === partyId) : undefined

  return (
    <section>
      <h1>Latest votes</h1>
      <p className="lede">
        Every electronic vote in the Chamber of Deputies and in joint sittings, newest first.
      </p>

      <div className="filters">
        <label>
          Party{' '}
          <select
            value={partyId ?? ''}
            onChange={(event) => {
              setPartyId(event.target.value ? Number(event.target.value) : undefined)
            }}
          >
            <option value="">All parties</option>
            {parties.status === 'ready' &&
              parties.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.abbreviation}
                </option>
              ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={finalOnly}
            onChange={(event) => {
              setFinalOnly(event.target.checked)
              setPage(0)
            }}
          />{' '}
          Final votes only
        </label>
      </div>

      <AsyncView state={votes}>
        {(data) =>
          data.votes.length === 0 ? (
            <p className="notice">No votes to show.</p>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vote</th>
                      <th className="num">For</th>
                      <th className="num">Against</th>
                      <th className="num">Abstained</th>
                      <th>Tally</th>
                      {party && <th>{party.abbreviation} position</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.votes.map((vote) => (
                      <VoteRow
                        key={vote.id}
                        vote={vote}
                        position={party ? (data.positions.get(vote.id) ?? null) : undefined}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="footnote">
                “Carried” means more votes for than against. The source does not publish the
                official outcome, which for some votes depends on a qualified majority.
              </p>
              <div className="pager">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Newer
                </button>
                <span>Page {page + 1}</span>
                <button
                  type="button"
                  disabled={data.votes.length < PAGE_SIZE}
                  onClick={() => setPage(page + 1)}
                >
                  Older
                </button>
              </div>
            </>
          )
        }
      </AsyncView>
    </section>
  )
}

interface RowProps {
  vote: Vote
  /** undefined: no party selected. null: the party cast no vote. */
  position: PartyPosition | null | undefined
}

function VoteRow({ vote, position }: RowProps) {
  return (
    <tr>
      <td className="nowrap">
        {formatDate(vote.sitting_date)}
        <div className="muted">{CHAMBER_LABELS[vote.chamber]}</div>
      </td>
      <td>
        <a href={vote.source_url} target="_blank" rel="noreferrer">
          {vote.title}
        </a>
        {vote.bill_title && (
          <div className="muted">
            {vote.bill_url ? (
              <a href={vote.bill_url} target="_blank" rel="noreferrer">
                {vote.bill_title}
              </a>
            ) : (
              vote.bill_title
            )}
          </div>
        )}
      </td>
      <td className="num">{vote.votes_for}</td>
      <td className="num">{vote.votes_against}</td>
      <td className="num">{vote.abstained}</td>
      <td>
        <ResultBadge result={vote.result} />
      </td>
      {position !== undefined && (
        <td>
          {position ? (
            <>
              <ChoiceBadge choice={position.position} />
              <div className="muted">
                {position.agreeing} of {position.voters} (
                {formatPercent(position.agreeing / position.voters)})
              </div>
            </>
          ) : (
            <span className="muted">No votes cast</span>
          )}
        </td>
      )}
    </tr>
  )
}
