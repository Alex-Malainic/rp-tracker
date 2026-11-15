import { useState } from 'react'
import { AsyncView, Card, ChoiceBadge, Notice, PageHeader, PartyDot, SectionTitle, Stat } from '../components/ui'
import { fetchAttendance, fetchMember, fetchMemberBallots, fetchPositions } from '../lib/api'
import { formatDate, formatPercent, plain } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { partyStyle } from '../lib/parties'
import { useData, useVisibleParties } from '../lib/store'
import type { Member } from '../lib/types'

const ROLE_LABELS = { deputies: 'Deputy', senate: 'Senator' }
const CHAMBERS = [
  { value: 'all', label: 'All' },
  { value: 'deputies', label: 'Deputies' },
  { value: 'senate', label: 'Senators' },
] as const

type ChamberFilter = (typeof CHAMBERS)[number]['value']

/** Members grouped by party, narrowed by the sidebar's party filter. */
export function Members() {
  const { membersByParty } = useData()
  const parties = useVisibleParties()
  const [search, setSearch] = useState('')
  const [chamber, setChamber] = useState<ChamberFilter>('all')

  const needle = plain(search.trim())
  const matches = (member: Member) =>
    (chamber === 'all' || member.chamber === chamber) && plain(member.name).includes(needle)
  const groups = parties
    .map((party) => ({ party, members: (membersByParty.get(party.id) ?? []).filter(matches) }))
    .filter((group) => group.members.length > 0)

  return (
    <>
      <PageHeader
        title="Members"
        lede="Deputies and senators of the current legislature, by group. Senators appear here because they vote in joint sittings."
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name…"
          aria-label="Search members by name"
          className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
        />
        <div className="flex rounded-lg border border-line bg-panel p-0.5 text-sm" role="group" aria-label="Chamber">
          {CHAMBERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={chamber === option.value}
              onClick={() => setChamber(option.value)}
              className={`cursor-pointer rounded-md px-3 py-1 font-medium ${
                chamber === option.value ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <div className="mt-6">
          <Notice>No members match.</Notice>
        </div>
      )}
      {groups.map(({ party, members }) => (
        <section key={party.id} style={partyStyle(party)}>
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <PartyDot party={party} />
            <a href={`#/parties/${party.id}`} className="hover:underline">
              {party.abbreviation}
            </a>
            <span className="text-sm font-normal text-ink-3">{members.length}</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {members.map((member) => (
              <li key={member.id}>
                <a
                  href={`#/members/${member.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line border-l-4 border-l-(--party) bg-panel px-3 py-2 text-sm hover:bg-sunken"
                >
                  <span className="truncate font-medium">{member.name}</span>
                  <span className="shrink-0 text-xs text-ink-3">{ROLE_LABELS[member.chamber]}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/** One member: attendance, dissent and recent ballots. */
export function MemberPage({ id }: { id: number }) {
  const { partyById } = useData()
  const state = useAsync(async () => {
    const [member, attendance, ballots] = await Promise.all([
      fetchMember(id),
      fetchAttendance(id),
      fetchMemberBallots(id),
    ])
    const positions = await fetchPositions(ballots.map((ballot) => ballot.votes.id))
    return {
      member,
      attendance,
      ballots,
      positions: new Map(positions.map((p) => [`${p.vote_id}:${p.party_id}`, p.position])),
    }
  }, [id])

  return (
    <>
      <a href="#/members" className="text-sm text-accent hover:underline">
        ← All members
      </a>
      <div className="mt-3">
        <AsyncView state={state}>
          {({ member, attendance, ballots, positions }) => {
            if (!member) return <Notice>No such member.</Notice>
            const party = partyById.get(member.party_id)
            return (
              <div style={partyStyle(party)}>
                <div className="flex items-center gap-3">
                  <span className="h-10 w-1.5 rounded-full bg-(--party)" aria-hidden="true" />
                  <PageHeader
                    title={member.name}
                    lede={
                      <>
                        {ROLE_LABELS[member.chamber]} ·{' '}
                        <a href={`#/parties/${member.party_id}`} className="text-accent hover:underline">
                          {party?.name}
                        </a>{' '}
                        · legislature {member.legislature}
                      </>
                    }
                  />
                </div>

                {attendance && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Stat
                        label="Attendance"
                        value={formatPercent(attendance.attendance)}
                        detail={`present at ${attendance.present} of ${attendance.eligible_votes} votes`}
                      />
                      <Stat
                        label="Votes against own group"
                        value={attendance.against_party}
                        detail={
                          attendance.voted > 0
                            ? `${formatPercent(attendance.against_party / attendance.voted)} of ${attendance.voted} votes cast`
                            : 'no votes cast'
                        }
                      />
                      <Stat
                        label="Present without voting"
                        value={attendance.present - attendance.voted}
                        detail="times"
                      />
                    </div>
                    <p className="mt-2 max-w-[80ch] text-xs text-ink-3">
                      Counted from {formatDate(attendance.first_seen)} to{' '}
                      {formatDate(attendance.last_seen)}. The source lists only members who were
                      present, so absence is inferred from the votes held in that period.
                    </p>
                  </>
                )}

                <SectionTitle>Recent ballots</SectionTitle>
                {ballots.length === 0 ? (
                  <Notice>No ballots recorded.</Notice>
                ) : (
                  <Card className="divide-y divide-line">
                    {ballots.map((ballot) => {
                      const position = positions.get(`${ballot.votes.id}:${ballot.party_id}`)
                      const dissent =
                        position !== undefined &&
                        ballot.choice !== 'not_voted' &&
                        ballot.choice !== position
                      return (
                        <article
                          key={ballot.votes.id}
                          className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-[1fr_9rem_9rem]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs text-ink-3">
                              {formatDate(ballot.votes.sitting_date)}
                            </div>
                            <a
                              href={ballot.votes.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium leading-snug hover:underline"
                            >
                              {ballot.votes.bill_title ?? ballot.votes.title}
                            </a>
                            {ballot.votes.bill_title && (
                              <div className="text-sm text-ink-2">{ballot.votes.title}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-ink-3">Ballot</div>
                            <ChoiceBadge choice={ballot.choice} />
                            {dissent && (
                              <div className="text-xs font-semibold text-warn">⚠ Against own group</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-ink-3">Group position</div>
                            {position ? <ChoiceBadge choice={position} /> : <span className="text-ink-3">–</span>}
                          </div>
                        </article>
                      )
                    })}
                  </Card>
                )}
              </div>
            )
          }}
        </AsyncView>
      </div>
    </>
  )
}
