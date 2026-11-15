-- Electoral constituencies (the 41 counties, Bucharest and the diaspora), the
-- region each belongs to, and where every member was elected.

create table public.constituencies (
    id integer primary key,
    name text not null unique,
    region text not null
);

comment on column public.constituencies.id is 'Official constituency number, 1 to 43.';
comment on column public.constituencies.region is
    'Development region as a slug, e.g. "nord-est", or "diaspora".';

alter table public.mps
    add column constituency_id integer references public.constituencies (id);

comment on column public.mps.constituency_id is
    'Where the member was elected. Null for members elected nationally '
    '(national minorities) and for members not yet matched.';

create index mps_constituency_id_idx on public.mps (constituency_id);

alter table public.constituencies enable row level security;
create policy "Public read" on public.constituencies
    for select to anon, authenticated using (true);
revoke all on public.constituencies from anon, authenticated;
grant select on public.constituencies to anon, authenticated;
grant all on public.constituencies to service_role;

-- Attendance and dissent summed over the members of each constituency.
create materialized view public.constituency_stats as
select
    m.constituency_id,
    count(*)::integer as members,
    coalesce(sum(a.eligible_votes), 0)::integer as eligible_votes,
    coalesce(sum(a.present), 0)::integer as present,
    coalesce(sum(a.voted), 0)::integer as voted,
    coalesce(sum(a.against_party), 0)::integer as against_party
from public.mps m
left join public.mp_attendance a on a.mp_id = m.id
where m.constituency_id is not null
group by m.constituency_id;

create unique index constituency_stats_key on public.constituency_stats (constituency_id);

-- How the members of each constituency voted on each vote.
create materialized view public.constituency_vote_tallies as
select
    b.vote_id,
    m.constituency_id,
    (count(*) filter (where b.choice = 'for'))::integer as votes_for,
    (count(*) filter (where b.choice = 'against'))::integer as votes_against,
    (count(*) filter (where b.choice = 'abstain'))::integer as abstained,
    (count(*) filter (where b.choice = 'not_voted'))::integer as not_voted
from public.ballots b
join public.mps m on m.id = b.mp_id
where m.constituency_id is not null
group by b.vote_id, m.constituency_id;

create unique index constituency_vote_tallies_key
    on public.constituency_vote_tallies (vote_id, constituency_id);

revoke all on public.constituency_stats, public.constituency_vote_tallies
from anon, authenticated;

grant select on public.constituency_stats, public.constituency_vote_tallies
to anon, authenticated, service_role;

-- The new views read mp_attendance, so they are refreshed after it.
create or replace function public.refresh_stats()
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
    refresh materialized view public.constituency_stats;
    refresh materialized view public.constituency_vote_tallies;
end;
$$;
