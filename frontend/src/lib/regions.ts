import type { Constituency, ConstituencyStats, Member } from './types'

/** Region slugs in display order: roughly north to south, diaspora last. */
export const REGION_ORDER = [
  'nord-est',
  'nord-vest',
  'centru',
  'vest',
  'sud-est',
  'sud-muntenia',
  'sud-vest-oltenia',
  'bucuresti-ilfov',
  'diaspora',
] as const

export type RegionSlug = (typeof REGION_ORDER)[number]

/** Attendance and dissent totals, for a constituency or a whole region. */
export interface Totals {
  members: number
  eligible_votes: number
  present: number
  voted: number
  against_party: number
}

export interface County {
  constituency: Constituency
  members: Member[]
  totals: Totals
}

export interface Region {
  slug: RegionSlug
  counties: County[]
  members: Member[]
  totals: Totals
}

const EMPTY: Totals = { members: 0, eligible_votes: 0, present: 0, voted: 0, against_party: 0 }

function add(a: Totals, b: Totals): Totals {
  return {
    members: a.members + b.members,
    eligible_votes: a.eligible_votes + b.eligible_votes,
    present: a.present + b.present,
    voted: a.voted + b.voted,
    against_party: a.against_party + b.against_party,
  }
}

/** Share of expected votes the members were present for, or null with no data. */
export const attendanceOf = (totals: Totals) =>
  totals.eligible_votes > 0 ? totals.present / totals.eligible_votes : null

/** Share of votes cast against the member's own group, or null with no data. */
export const dissentOf = (totals: Totals) =>
  totals.voted > 0 ? totals.against_party / totals.voted : null

/** Group constituencies, their members and their statistics into regions. */
export function buildRegions(
  constituencies: Constituency[],
  stats: ConstituencyStats[],
  members: Member[],
): Region[] {
  const statsById = new Map(stats.map((row) => [row.constituency_id, row]))
  const membersById = new Map<number, Member[]>()
  for (const member of members) {
    if (member.constituency_id === null) continue
    const list = membersById.get(member.constituency_id)
    if (list) list.push(member)
    else membersById.set(member.constituency_id, [member])
  }

  return REGION_ORDER.map((slug) => {
    const counties = constituencies
      .filter((constituency) => constituency.region === slug)
      .map((constituency) => {
        const seated = membersById.get(constituency.id) ?? []
        return {
          constituency,
          members: seated,
          // Member counts come from the member list, so they match the names shown.
          totals: { ...(statsById.get(constituency.id) ?? EMPTY), members: seated.length },
        }
      })
    return {
      slug,
      counties,
      members: counties.flatMap((county) => county.members),
      totals: counties.reduce((sum, county) => add(sum, county.totals), EMPTY),
    }
  }).filter((region) => region.counties.length > 0)
}
