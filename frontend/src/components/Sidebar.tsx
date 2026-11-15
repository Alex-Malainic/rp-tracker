import { useState } from 'react'
import { plain } from '../lib/format'
import { useData, useFilters } from '../lib/store'
import { PartyDot } from './ui'

const NAV = [
  { path: '/', label: 'Parties', icon: '◧' },
  { path: '/votes', label: 'Votes', icon: '☰' },
  { path: '/members', label: 'Members', icon: '☺' },
]

const MAX_MATCHES = 8

export function Sidebar({ section, onNavigate }: { section: string; onNavigate: () => void }) {
  const { parties, members, membersByParty, partyById } = useData()
  const { selected, toggleParty, clearParties, finalOnly, setFinalOnly } = useFilters()
  const [search, setSearch] = useState('')

  const needle = plain(search.trim())
  const matches = needle
    ? members
        .filter(
          (member) =>
            plain(member.name).includes(needle) &&
            (selected.size === 0 || selected.has(member.party_id)),
        )
        .slice(0, MAX_MATCHES)
    : []

  return (
    <div className="quiet-scroll flex h-full flex-col gap-6 overflow-y-auto p-4">
      <a href="#/" onClick={onNavigate} className="flex items-center gap-2.5 px-2 pt-1">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-panel">
          RP
        </span>
        <span className="text-sm font-semibold leading-tight">
          Parliament
          <br />
          Vote Tracker
        </span>
      </a>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = section === item.path
          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-sunken hover:text-ink'
              }`}
            >
              <span aria-hidden="true" className="w-4 text-center">
                {item.icon}
              </span>
              {item.label}
            </a>
          )
        })}
      </nav>

      <section aria-labelledby="filter-members">
        <h2 id="filter-members" className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
          Find a member
        </h2>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name…"
          aria-label="Search members by name"
          className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
        />
        {needle && (
          <ul className="mt-1.5 flex flex-col">
            {matches.length === 0 && <li className="px-2 py-1.5 text-sm text-ink-3">No members match.</li>}
            {matches.map((member) => (
              <li key={member.id}>
                <a
                  href={`#/members/${member.id}`}
                  onClick={() => {
                    setSearch('')
                    onNavigate()
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sunken"
                >
                  <PartyDot party={partyById.get(member.party_id)} />
                  <span className="min-w-0 grow truncate">{member.name}</span>
                  <span className="text-xs text-ink-3">
                    {partyById.get(member.party_id)?.abbreviation}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="filter-parties">
        <div className="flex items-baseline justify-between px-2">
          <h2 id="filter-parties" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Parties
          </h2>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clearParties}
              className="cursor-pointer text-xs font-medium text-accent hover:underline"
            >
              Show all
            </button>
          )}
        </div>
        <ul className="mt-2 flex flex-col gap-0.5">
          {parties.map((party) => {
            const active = selected.has(party.id)
            return (
              <li key={party.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleParty(party.id)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                    active ? 'bg-sunken font-semibold text-ink' : 'text-ink-2 hover:bg-sunken'
                  } ${selected.size > 0 && !active ? 'opacity-55' : ''}`}
                >
                  <PartyDot party={party} />
                  <span className="grow truncate">{party.abbreviation}</span>
                  <span className="text-xs tabular-nums text-ink-3">
                    {membersByParty.get(party.id)?.length ?? 0}
                  </span>
                  <span aria-hidden="true" className="w-3 text-xs text-accent">
                    {active ? '✓' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 px-2 text-xs text-ink-3">
          Pick one or more to focus every page on them. Numbers are members.
        </p>
      </section>

      <section aria-labelledby="filter-votes">
        <h2 id="filter-votes" className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
          Votes
        </h2>
        <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-sunken">
          Final votes only
          <input
            type="checkbox"
            checked={finalOnly}
            onChange={(event) => setFinalOnly(event.target.checked)}
            className="size-4 accent-(--color-accent)"
          />
        </label>
        <p className="mt-1 px-2 text-xs text-ink-3">
          Hides procedural votes such as agenda approvals.
        </p>
      </section>

      <p className="mt-auto px-2 text-xs text-ink-3">
        Data from{' '}
        <a
          className="underline hover:text-ink"
          href="https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1"
          target="_blank"
          rel="noreferrer"
        >
          cdep.ro
        </a>
        , updated daily. Not an official publication.
      </p>
    </div>
  )
}
