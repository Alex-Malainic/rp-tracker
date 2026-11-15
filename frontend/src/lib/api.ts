import { supabase } from './supabase'
import type {
  Attendance,
  CohesionPoint,
  Member,
  MemberBallot,
  Party,
  PartyPosition,
  SimilarityCell,
  Vote,
} from './types'

export const PAGE_SIZE = 50

function db() {
  if (!supabase) throw new Error('Supabase is not configured for this build.')
  return supabase
}

/** Unwrap a Supabase response, turning its error object into an exception. */
function rows<T>(response: { data: unknown; error: { message: string } | null }): T[] {
  if (response.error) throw new Error(response.error.message)
  return (response.data ?? []) as T[]
}

export async function fetchParties(): Promise<Party[]> {
  return rows(await db().from('parties').select('*').order('abbreviation'))
}

export async function fetchVotes(page: number, finalOnly: boolean): Promise<Vote[]> {
  let query = db().from('votes').select('*')
  if (finalOnly) query = query.eq('is_final', true)
  return rows(
    await query
      .order('sitting_date', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
  )
}

/** Positions of every group, or of one group, on the given votes. */
export async function fetchPositions(voteIds: number[], partyId?: number): Promise<PartyPosition[]> {
  if (voteIds.length === 0) return []
  let query = db().from('party_vote_positions').select('*').in('vote_id', voteIds)
  if (partyId !== undefined) query = query.eq('party_id', partyId)
  return rows(await query)
}

export async function fetchCohesion(): Promise<CohesionPoint[]> {
  return rows(await db().from('party_cohesion_monthly').select('*').order('month'))
}

export async function fetchSimilarityYears(): Promise<number[]> {
  const found = rows<{ year: number }>(
    await db().from('party_similarity').select('year').order('year', { ascending: false }),
  )
  return [...new Set(found.map((row) => row.year))]
}

export async function fetchSimilarity(year: number): Promise<SimilarityCell[]> {
  return rows(await db().from('party_similarity').select('*').eq('year', year))
}

/** Members of the most recent legislature, by name. */
export async function fetchMembers(): Promise<Member[]> {
  const latest = rows<{ legislature: number }>(
    await db().from('mps').select('legislature').order('legislature', { ascending: false }).limit(1),
  )
  if (latest.length === 0) return []
  return rows(
    await db().from('mps').select('*').eq('legislature', latest[0].legislature).order('name'),
  )
}

export async function fetchMember(id: number): Promise<Member | null> {
  return rows<Member>(await db().from('mps').select('*').eq('id', id).limit(1))[0] ?? null
}

export async function fetchAttendance(memberId: number): Promise<Attendance | null> {
  const found = rows<Attendance>(
    await db().from('mp_attendance').select('*').eq('mp_id', memberId).limit(1),
  )
  return found[0] ?? null
}

export async function fetchMemberBallots(memberId: number): Promise<MemberBallot[]> {
  return rows(
    await db()
      .from('ballots')
      .select('choice, party_id, votes(id, sitting_date, title, bill_title, is_final, source_url)')
      .eq('mp_id', memberId)
      .order('vote_id', { ascending: false })
      .limit(PAGE_SIZE),
  )
}
