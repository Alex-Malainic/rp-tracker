import { createContext, useContext } from 'react'
import {
  fetchCohesion,
  fetchConstituencies,
  fetchConstituencyStats,
  fetchMembers,
  fetchParties,
} from './api'
import { useAsync, type Async } from './hooks'
import { buildRegions, type Region } from './regions'
import type { CohesionPoint, Member, Party } from './types'

/** Reference data every page needs, loaded once. */
export interface AppData {
  parties: Party[]
  partyById: Map<number, Party>
  members: Member[]
  membersByParty: Map<number, Member[]>
  cohesionByParty: Map<number, CohesionPoint[]>
  /** Regions with their constituencies; empty until constituencies are loaded. */
  regions: Region[]
}

/** The sidebar's filters, shared by all pages. */
export interface Filters {
  /** Ids of the selected groups. Empty means "all groups". */
  selected: ReadonlySet<number>
  toggleParty: (id: number) => void
  clearParties: () => void
  finalOnly: boolean
  setFinalOnly: (value: boolean) => void
}

export const DataContext = createContext<AppData | null>(null)
export const FiltersContext = createContext<Filters | null>(null)

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}

export function useAppDataLoader(): Async<AppData> {
  return useAsync(async () => {
    const [parties, members, cohesion, constituencies, constituencyStats] = await Promise.all([
      fetchParties(),
      fetchMembers(),
      fetchCohesion(),
      fetchConstituencies(),
      fetchConstituencyStats(),
    ])
    const membersByParty = groupBy(members, (member) => member.party_id)
    // Largest groups first: that is the order people expect to read them in.
    parties.sort(
      (a, b) =>
        (membersByParty.get(b.id)?.length ?? 0) - (membersByParty.get(a.id)?.length ?? 0) ||
        a.abbreviation.localeCompare(b.abbreviation),
    )
    return {
      parties,
      partyById: new Map(parties.map((party) => [party.id, party])),
      members,
      membersByParty,
      cohesionByParty: groupBy(cohesion, (point) => point.party_id),
      regions: buildRegions(constituencies, constituencyStats, members),
    }
  }, [])
}

export function useData(): AppData {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData must be used inside <Providers>')
  return data
}

export function useFilters(): Filters {
  const filters = useContext(FiltersContext)
  if (!filters) throw new Error('useFilters must be used inside <Providers>')
  return filters
}

/** The groups the current filter shows: the selected ones, or all of them. */
export function useVisibleParties(): Party[] {
  const { parties } = useData()
  const { selected } = useFilters()
  return selected.size === 0 ? parties : parties.filter((party) => selected.has(party.id))
}
