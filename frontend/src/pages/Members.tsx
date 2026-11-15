import { useState } from 'react'
import { AsyncView } from '../components/AsyncView'
import { ChoiceBadge } from '../components/Badges'
import {
  fetchAttendance,
  fetchMember,
  fetchMemberBallots,
  fetchMembers,
  fetchParties,
  fetchPositions,
} from '../lib/api'
import { formatDate, formatPercent } from '../lib/format'
import { useAsync } from '../lib/hooks'
import type { Party } from '../lib/types'

const ROLE_LABELS = { deputies: 'Deputy', senate: 'Senator' }

/** The list of members, with a search box. */
export function Members() {
  const [search, setSearch] = useState('')
  const state = useAsync(async () => {
    const [members, parties] = await Promise.all([fetchMembers(), fetchParties()])
    return { members, parties: partyLookup(parties) }
  }, [])

  return (
    <section>
      <h1>Members</h1>
      <div className="filters">
        <label>
          Search by name{' '}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      <AsyncView state={state}>
        {({ members, parties }) => {
          const needle = plain(search)
          const found = members.filter((member) => plain(member.name).includes(needle))
          if (found.length === 0) return <p className="notice">No members match.</p>
          return (
            <ul className="member-list">
              {found.map((member) => (
                <li key={member.id}>
                  <a href={`#/members/${member.id}`}>{member.name}</a>{' '}
                  <span className="muted">
                    {parties.get(member.party_id)?.abbreviation} · {ROLE_LABELS[member.chamber]}
                  </span>
                </li>
              ))}
            </ul>
          )
        }}
      </AsyncView>
    </section>
  )
}

/** One member: attendance, dissent and recent ballots. */
export function MemberPage({ id }: { id: number }) {
  const state = useAsync(async () => {
    const [member, attendance, ballots, parties] = await Promise.all([
      fetchMember(id),
      fetchAttendance(id),
      fetchMemberBallots(id),
      fetchParties(),
    ])
    const positions = await fetchPositions(ballots.map((ballot) => ballot.votes.id))
    return {
      member,
      attendance,
      ballots,
      parties: partyLookup(parties),
      positions: new Map(positions.map((p) => [`${p.vote_id}:${p.party_id}`, p.position])),
    }
  }, [id])

  return (
    <section>
      <p>
        <a href="#/members">← All members</a>
      </p>
      <AsyncView state={state}>
        {({ member, attendance, ballots, parties, positions }) => {
          if (!member) return <p className="notice">No such member.</p>
          return (
            <>
              <h1>{member.name}</h1>
              <p className="lede">
                {ROLE_LABELS[member.chamber]} · {parties.get(member.party_id)?.name} · legislature{' '}
                {member.legislature}
              </p>

              {attendance && (
                <>
                  <div className="tiles">
                    <Tile
                      label="Attendance"
                      value={formatPercent(attendance.attendance)}
                      detail={`present at ${attendance.present} of ${attendance.eligible_votes} votes`}
                    />
                    <Tile
                      label="Votes against own group"
                      value={String(attendance.against_party)}
                      detail={
                        attendance.voted > 0
                          ? `${formatPercent(attendance.against_party / attendance.voted)} of ${attendance.voted} votes cast`
                          : 'no votes cast'
                      }
                    />
                    <Tile
                      label="Present without voting"
                      value={String(attendance.present - attendance.voted)}
                      detail="times"
                    />
                  </div>
                  <p className="footnote">
                    Counted from {formatDate(attendance.first_seen)} to{' '}
                    {formatDate(attendance.last_seen)}. The source lists only members who were
                    present, so absence is inferred from votes held in that period.
                  </p>
                </>
              )}

              <h2>Recent ballots</h2>
              {ballots.length === 0 ? (
                <p className="notice">No ballots recorded.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Vote</th>
                        <th>Ballot</th>
                        <th>Group position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ballots.map((ballot) => {
                        const position = positions.get(`${ballot.votes.id}:${ballot.party_id}`)
                        const dissent =
                          position !== undefined &&
                          ballot.choice !== 'not_voted' &&
                          ballot.choice !== position
                        return (
                          <tr key={ballot.votes.id}>
                            <td className="nowrap">{formatDate(ballot.votes.sitting_date)}</td>
                            <td>
                              <a href={ballot.votes.source_url} target="_blank" rel="noreferrer">
                                {ballot.votes.title}
                              </a>
                              {ballot.votes.bill_title && (
                                <div className="muted">{ballot.votes.bill_title}</div>
                              )}
                            </td>
                            <td>
                              <ChoiceBadge choice={ballot.choice} />
                            </td>
                            <td>
                              {position ? <ChoiceBadge choice={position} /> : '–'}
                              {dissent && <div className="dissent">⚠ Against own group</div>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        }}
      </AsyncView>
    </section>
  )
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card tile">
      <div className="muted">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="muted">{detail}</div>
    </div>
  )
}

function partyLookup(parties: Party[]): Map<number, Party> {
  return new Map(parties.map((party) => [party.id, party]))
}

/** Lower-case and strip diacritics, so "tusa" finds "Tuşa". */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
