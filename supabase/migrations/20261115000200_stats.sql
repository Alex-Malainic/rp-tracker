-- Aggregates for the charts, precomputed so the frontend never scans ballots.
-- They are materialized views, rebuilt by refresh_stats() after each ingestion.

-- The position of each group on each vote: the choice most of its voting
-- members made. Members who did not vote are left out.
create materialized view public.party_vote_positions as
with counts as (
    select vote_id, party_id, choice, count(*) as members
    from public.ballots
    where choice <> 'not_voted'
    group by vote_id, party_id, choice
),
ranked as (
    select
        vote_id,
        party_id,
        choice,
        members,
        sum(members) over (partition by vote_id, party_id) as voters,
        row_number() over (
            partition by vote_id, party_id order by members desc, choice
        ) as position_rank
    from counts
)
select
    vote_id,
    party_id,
    choice as position,
    members::integer as agreeing,
    voters::integer as voters
from ranked
where position_rank = 1;

create unique index party_vote_positions_key on public.party_vote_positions (vote_id, party_id);

-- Cohesion: of the ballots a group cast in a month, the share that matched
-- the group's position.
create materialized view public.party_cohesion_monthly as
select
    date_trunc('month', v.sitting_date)::date as month,
    p.party_id,
    round(sum(p.agreeing)::numeric / sum(p.voters), 4) as cohesion,
    count(*)::integer as votes
from public.party_vote_positions p
join public.votes v on v.id = p.vote_id
group by 1, 2;

create unique index party_cohesion_monthly_key on public.party_cohesion_monthly (month, party_id);

-- Similarity: the share of votes in a year on which two groups took the same
-- position. Both orderings of a pair are stored, so a heatmap needs no union.
create materialized view public.party_similarity as
select
    extract(year from v.sitting_date)::integer as year,
    a.party_id as party_a,
    b.party_id as party_b,
    round(avg((a.position = b.position)::integer), 4) as agreement,
    count(*)::integer as votes
from public.party_vote_positions a
join public.party_vote_positions b on b.vote_id = a.vote_id and b.party_id <> a.party_id
join public.votes v on v.id = a.vote_id
group by 1, 2, 3;

create unique index party_similarity_key on public.party_similarity (year, party_a, party_b);

-- Attendance per member. The source lists only members who were present, so
-- absence is inferred: a member is expected at every vote of their chamber
-- (and every joint vote) between their first and last recorded ballot.
create materialized view public.mp_attendance as
with span as (
    select
        b.mp_id,
        min(v.sitting_date) as first_seen,
        max(v.sitting_date) as last_seen,
        count(*) as present,
        count(*) filter (where b.choice <> 'not_voted') as voted
    from public.ballots b
    join public.votes v on v.id = b.vote_id
    group by b.mp_id
),
expected as (
    select s.mp_id, count(*) as eligible
    from span s
    join public.mps m on m.id = s.mp_id
    join public.votes v
        on v.sitting_date between s.first_seen and s.last_seen
        and (v.chamber = 'joint' or v.chamber = m.chamber)
    group by s.mp_id
),
dissent as (
    select b.mp_id, count(*) as against_party
    from public.ballots b
    join public.party_vote_positions p on p.vote_id = b.vote_id and p.party_id = b.party_id
    where b.choice <> 'not_voted' and b.choice <> p.position
    group by b.mp_id
)
select
    s.mp_id,
    s.first_seen,
    s.last_seen,
    e.eligible::integer as eligible_votes,
    s.present::integer as present,
    s.voted::integer as voted,
    round(s.present::numeric / e.eligible, 4) as attendance,
    coalesce(d.against_party, 0)::integer as against_party
from span s
join expected e on e.mp_id = s.mp_id
left join dissent d on d.mp_id = s.mp_id;

create unique index mp_attendance_key on public.mp_attendance (mp_id);

-- Row level security does not apply to materialized views; they hold only
-- public aggregates, so read access is granted outright.
revoke all on
    public.party_vote_positions,
    public.party_cohesion_monthly,
    public.party_similarity,
    public.mp_attendance
from anon, authenticated;

grant select on
    public.party_vote_positions,
    public.party_cohesion_monthly,
    public.party_similarity,
    public.mp_attendance
to anon, authenticated, service_role;

-- Called by the ingestion job. party_vote_positions goes first because the
-- other views read from it.
create function public.refresh_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    refresh materialized view public.party_vote_positions;
    refresh materialized view public.party_cohesion_monthly;
    refresh materialized view public.party_similarity;
    refresh materialized view public.mp_attendance;
end;
$$;

revoke all on function public.refresh_stats() from public, anon, authenticated;
grant execute on function public.refresh_stats() to service_role;
