import { PartyMix } from '../components/PartyMix'
import { AsyncView, Card, Notice, PageHeader, PartyDot, SectionTitle, Stat } from '../components/ui'
import { VoteList } from '../components/VoteList'
import { fetchConstituencyTallies, fetchVotePage } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { useLocale } from '../lib/i18n'
import { attendanceOf, dissentOf, type Region, type Totals } from '../lib/regions'
import { useData, useFilters, useVisibleParties } from '../lib/store'
import type { Tally } from '../lib/types'

/** A share as text, or a dash when there is nothing to divide by. */
function useShare() {
  const { percent } = useLocale()
  return (share: number | null) => (share === null ? '–' : percent(share))
}

/** A horizontal bar for a share, on a scale shared by its neighbours. */
function ShareBar({ share, max }: { share: number | null; max: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunken">
      {share !== null && (
        <div
          className="bg-brand h-full rounded-full"
          style={{ width: `${max > 0 ? Math.min(100, (share / max) * 100) : 0}%` }}
        />
      )}
    </div>
  )
}

/** Rows of name, members, attendance and dissent, for regions or counties. */
function ComparisonTable({
  heading,
  rows,
}: {
  heading: string
  rows: { key: string; name: string; href?: string; totals: Totals }[]
}) {
  const { t } = useLocale()
  const share = useShare()
  const maxDissent = Math.max(0, ...rows.map((row) => dissentOf(row.totals) ?? 0))

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
            <th className="px-4 py-3 font-medium">{heading}</th>
            <th className="px-4 py-3 text-right font-medium">{t('regions.colMembers')}</th>
            <th className="w-[28%] px-4 py-3 font-medium">{t('regions.attendance')}</th>
            <th className="w-[28%] px-4 py-3 font-medium">{t('regions.dissent')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {rows.map((row) => {
            const attendance = attendanceOf(row.totals)
            const dissent = dissentOf(row.totals)
            return (
              <tr key={row.key}>
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {row.href ? (
                    <a href={row.href} className="hover:underline">
                      {row.name}
                    </a>
                  ) : (
                    row.name
                  )}
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{row.totals.members}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 tabular-nums">{share(attendance)}</span>
                    <div className="grow">
                      <ShareBar share={attendance} max={1} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 tabular-nums">{share(dissent)}</span>
                    <div className="grow">
                      <ShareBar share={dissent} max={maxDissent} />
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

/** All regions: one card each, then a table that compares them. */
export function Regions() {
  const { t } = useLocale()
  const { regions } = useData()
  const share = useShare()

  if (regions.length === 0) {
    return (
      <>
        <PageHeader title={t('regions.title')} lede={t('regions.lede')} />
        <Notice>{t('regions.none')}</Notice>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('regions.title')} lede={t('regions.lede')} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {regions.map((region) => (
          <Card
            key={region.slug}
            className="flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <a
                  href={`#/regions/${region.slug}`}
                  className="text-lg font-semibold tracking-tight hover:underline"
                >
                  {t(`region.${region.slug}`)}
                </a>
                <div className="text-sm text-ink-2">
                  {t('regions.counties', { n: region.counties.length })}
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs font-medium text-ink-2">
                {t('regions.members', { n: region.totals.members })}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">
                  {t('regions.attendance')}
                </dt>
                <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {share(attendanceOf(region.totals))}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">
                  {t('regions.dissent')}
                </dt>
                <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {share(dissentOf(region.totals))}
                </dd>
              </div>
            </dl>

            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
                {t('regions.partyMix')}
              </div>
              <PartyMix members={region.members} />
            </div>

            <a
              href={`#/regions/${region.slug}`}
              className="mt-auto text-sm font-medium text-accent hover:underline"
            >
              {t('regions.open')}
            </a>
          </Card>
        ))}
      </div>

      <SectionTitle note={t('regions.compareNote')}>{t('regions.compareTitle')}</SectionTitle>
      <ComparisonTable
        heading={t('regions.colRegion')}
        rows={regions.map((region) => ({
          key: region.slug,
          name: t(`region.${region.slug}`),
          href: `#/regions/${region.slug}`,
          totals: region.totals,
        }))}
      />
      <p className="mt-3 max-w-[80ch] text-xs text-ink-3">{t('regions.note')}</p>
    </>
  )
}

/** One region: its counties, how it voted recently, and its members. */
export function RegionPage({ slug }: { slug: string }) {
  const { t } = useLocale()
  const { regions } = useData()
  const region = regions.find((candidate) => candidate.slug === slug)

  if (!region) {
    return (
      <>
        <a href="#/regions" className="text-sm text-accent hover:underline">
          {t('region.back')}
        </a>
        <div className="mt-3">
          <Notice>{t('region.missing')}</Notice>
        </div>
      </>
    )
  }
  return <RegionDetail region={region} />
}

function RegionDetail({ region }: { region: Region }) {
  const { t } = useLocale()
  const { partyById } = useData()
  const { finalOnly } = useFilters()
  const visibleParties = useVisibleParties()
  const share = useShare()
  const name = t(`region.${region.slug}`)
  const constituencyIds = region.counties.map((county) => county.constituency.id).join(',')

  // Recent votes, with this region's own tally summed over its constituencies.
  const votes = useAsync(async () => {
    const page = await fetchVotePage(0, finalOnly)
    const tallies = await fetchConstituencyTallies(
      page.votes.map((vote) => vote.id),
      constituencyIds.split(',').map(Number),
    )
    const byVote = new Map<number, Tally>()
    for (const row of tallies) {
      const sum = byVote.get(row.vote_id) ?? { votes_for: 0, votes_against: 0, abstained: 0 }
      byVote.set(row.vote_id, {
        votes_for: sum.votes_for + row.votes_for,
        votes_against: sum.votes_against + row.votes_against,
        abstained: sum.abstained + row.abstained,
      })
    }
    return { page, byVote }
  }, [finalOnly, constituencyIds])

  const visibleIds = new Set(visibleParties.map((party) => party.id))

  return (
    <>
      <a href="#/regions" className="text-sm text-accent hover:underline">
        {t('region.back')}
      </a>
      <div className="mt-3">
        <PageHeader
          title={name}
          lede={region.counties.map((county) => county.constituency.name).join(' · ')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon="☺" label={t('regions.colMembers')} value={region.totals.members} />
        <Stat icon="◎" label={t('region.countiesTitle')} value={region.counties.length} />
        <Stat label={t('regions.attendance')} value={share(attendanceOf(region.totals))} />
        <Stat label={t('regions.dissent')} value={share(dissentOf(region.totals))} />
      </div>

      <SectionTitle>{t('regions.partyMix')}</SectionTitle>
      <Card className="p-4">
        <PartyMix members={region.members} />
      </Card>

      {region.counties.length > 1 && (
        <>
          <SectionTitle note={t('regions.compareNote')}>{t('region.countiesTitle')}</SectionTitle>
          <ComparisonTable
            heading={t('regions.colCounty')}
            rows={region.counties.map((county) => ({
              key: String(county.constituency.id),
              name: county.constituency.name,
              totals: county.totals,
            }))}
          />
        </>
      )}

      <SectionTitle note={t('region.votesNote')}>{t('region.votesTitle')}</SectionTitle>
      <AsyncView state={votes}>
        {({ page, byVote }) => (
          <VoteList page={page} parties={[]} extraTallies={byVote} extraLabel={name} />
        )}
      </AsyncView>

      <SectionTitle>{t('region.membersTitle')}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {region.counties.map((county) => {
          const members = county.members.filter((member) => visibleIds.has(member.party_id))
          return (
            <Card key={county.constituency.id} className="p-4">
              <h3 className="flex items-baseline justify-between gap-2 font-semibold">
                {county.constituency.name}
                <span className="text-sm font-normal text-ink-3">{members.length}</span>
              </h3>
              <ul className="mt-2 flex flex-col">
                {members.map((member) => (
                  <li key={member.id}>
                    <a
                      href={`#/members/${member.id}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-sunken"
                    >
                      <PartyDot party={partyById.get(member.party_id)} />
                      <span className="min-w-0 grow truncate">{member.name}</span>
                      <span className="shrink-0 text-xs text-ink-3">
                        {partyById.get(member.party_id)?.abbreviation} ·{' '}
                        {t(`role.${member.chamber}`)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </>
  )
}
