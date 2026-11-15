import { useState } from 'react'
import { plain } from '../lib/format'
import { useLocale, type MessageKey } from '../lib/i18n'
import { partyStyle } from '../lib/parties'
import { useData, useFilters } from '../lib/store'
import { PartyDot } from './ui'

const NAV: { path: string; label: MessageKey; icon: string }[] = [
  { path: '/', label: 'nav.parties', icon: '◧' },
  { path: '/regions', label: 'nav.regions', icon: '◎' },
  { path: '/votes', label: 'nav.votes', icon: '☰' },
  { path: '/members', label: 'nav.members', icon: '☺' },
]

const MAX_MATCHES = 8

export function Sidebar({ section, onNavigate }: { section: string; onNavigate: () => void }) {
  const { t } = useLocale()
  const { parties, members, membersByParty, partyById } = useData()
  const { selected, toggleParty, clearParties, finalOnly, setFinalOnly } = useFilters()
  const [search, setSearch] = useState('')

  const largest = Math.max(1, ...parties.map((party) => membersByParty.get(party.id)?.length ?? 0))
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
        <span className="bg-brand grid size-9 place-items-center rounded-xl text-sm font-bold text-white shadow-md shadow-accent/30 dark:text-canvas">
          RP
        </span>
        <span className="text-sm font-semibold leading-tight">
          {t('brand.line1')}
          <br />
          {t('brand.line2')}
        </span>
      </a>

      <nav aria-label={t('app.title')} className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = section === item.path
          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand text-white shadow-md shadow-accent/25 dark:text-canvas'
                  : 'text-ink-2 hover:bg-sunken hover:text-ink'
              }`}
            >
              <span aria-hidden="true" className="w-4 text-center">
                {item.icon}
              </span>
              {t(item.label)}
            </a>
          )
        })}
      </nav>

      <section aria-labelledby="filter-members">
        <h2 id="filter-members" className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
          {t('sidebar.find')}
        </h2>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.aria')}
          className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
        />
        {needle && (
          <ul className="mt-1.5 flex flex-col">
            {matches.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-ink-3">{t('search.none')}</li>
            )}
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
        <div className="flex items-center justify-between px-2">
          <h2 id="filter-parties" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            {t('sidebar.parties')}
          </h2>
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={clearParties}
              className="cursor-pointer rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent hover:underline"
            >
              {t('sidebar.selected', { n: selected.size })}
            </button>
          ) : (
            <span className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-3">
              {t('sidebar.all', { n: parties.length })}
            </span>
          )}
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {parties.map((party) => {
            const active = selected.has(party.id)
            const size = membersByParty.get(party.id)?.length ?? 0
            return (
              <li key={party.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleParty(party.id)}
                  style={partyStyle(party)}
                  title={t('sidebar.partyTitle', { name: party.name, n: size })}
                  className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2 text-left transition ${
                    active
                      ? 'border-(--party)/60 bg-(--party)/12 shadow-sm'
                      : 'border-transparent hover:border-line hover:bg-sunken'
                  } ${selected.size > 0 && !active ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums ring-1 ring-(--party)/45 transition ${
                      active ? 'bg-(--party)/35' : 'bg-(--party)/15 group-hover:bg-(--party)/25'
                    }`}
                  >
                    {size}
                  </span>
                  <span className="min-w-0 grow">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${active ? 'font-semibold' : 'font-medium'}`}>
                        {party.abbreviation}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold transition ${
                          active ? 'bg-(--party) text-white' : 'border border-line text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                    </span>
                    {/* Size relative to the largest group. */}
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sunken group-hover:bg-line">
                      <span
                        className="block h-full rounded-full bg-(--party)"
                        style={{ width: `${(size / largest) * 100}%` }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 px-2 text-xs text-ink-3">{t('sidebar.partiesHelp')}</p>
      </section>

      <section aria-labelledby="filter-votes">
        <h2 id="filter-votes" className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
          {t('sidebar.votes')}
        </h2>
        <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-sunken">
          {t('sidebar.finalOnly')}
          <input
            type="checkbox"
            checked={finalOnly}
            onChange={(event) => setFinalOnly(event.target.checked)}
            className="size-4 accent-(--color-accent)"
          />
        </label>
        <p className="mt-1 px-2 text-xs text-ink-3">{t('sidebar.finalHelp')}</p>
      </section>

      <p className="mt-auto px-2 text-xs text-ink-3">
        {t('sidebar.sourceBefore')}{' '}
        <a
          className="underline hover:text-ink"
          href="https://www.cdep.ro/ords/pls/steno/evot2015.data?idl=1"
          target="_blank"
          rel="noreferrer"
        >
          cdep.ro
        </a>
        {t('sidebar.sourceAfter')}
      </p>
    </div>
  )
}
