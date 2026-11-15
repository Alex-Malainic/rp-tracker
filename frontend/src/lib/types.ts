export type Chamber = 'deputies' | 'senate' | 'joint'
export type Choice = 'for' | 'against' | 'abstain' | 'not_voted'
export type Result = 'passed' | 'failed'

export interface Party {
  id: number
  abbreviation: string
  name: string
}

export interface Vote {
  id: number
  sitting_date: string
  voted_time: string | null
  chamber: Chamber
  title: string
  is_final: boolean
  bill_title: string | null
  bill_url: string | null
  source_url: string
  present: number
  votes_for: number
  votes_against: number
  abstained: number
  not_voted: number
  result: Result
}

export interface PartyPosition {
  vote_id: number
  party_id: number
  position: Exclude<Choice, 'not_voted'>
  agreeing: number
  voters: number
}

export interface CohesionPoint {
  month: string
  party_id: number
  cohesion: number
  votes: number
}

export interface SimilarityCell {
  year: number
  party_a: number
  party_b: number
  agreement: number
  votes: number
}

export interface Member {
  id: number
  chamber: Exclude<Chamber, 'joint'>
  legislature: number
  source_id: number
  name: string
  party_id: number
  /** Null for members elected nationally (the national minorities). */
  constituency_id: number | null
}

/** One of the 43 electoral constituencies: a county, Bucharest or the diaspora. */
export interface Constituency {
  id: number
  name: string
  /** Development region as a slug, e.g. "nord-est". */
  region: string
}

/** Attendance and dissent summed over a constituency's members. */
export interface ConstituencyStats {
  constituency_id: number
  members: number
  eligible_votes: number
  present: number
  voted: number
  against_party: number
}

/** Counts of the three choices a member can cast. */
export interface Tally {
  votes_for: number
  votes_against: number
  abstained: number
}

/** How a constituency's members voted on one vote. */
export interface ConstituencyTally {
  vote_id: number
  constituency_id: number
  votes_for: number
  votes_against: number
  abstained: number
  not_voted: number
}

export interface Attendance {
  mp_id: number
  first_seen: string
  last_seen: string
  eligible_votes: number
  present: number
  voted: number
  attendance: number
  against_party: number
}

export interface MemberBallot {
  choice: Choice
  party_id: number
  votes: Pick<Vote, 'id' | 'sitting_date' | 'title' | 'bill_title' | 'is_final' | 'source_url'>
}
