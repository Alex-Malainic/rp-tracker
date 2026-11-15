-- Core tables. Natural keys are unique so that ingestion can upsert and
-- re-running a day never duplicates rows.

create type public.chamber as enum ('deputies', 'senate', 'joint');

-- 'not_voted' is a member who was present without casting a vote. Members who
-- were absent have no ballot row at all: the source lists only those present.
create type public.ballot_choice as enum ('for', 'against', 'abstain', 'not_voted');

create table public.parties (
    id bigint generated always as identity primary key,
    abbreviation text not null unique,
    name text not null
);

comment on table public.parties is
    'Parliamentary groups as labelled by cdep.ro, including "Neafiliati" and "Minoritati".';

create table public.mps (
    id bigint generated always as identity primary key,
    chamber public.chamber not null check (chamber <> 'joint'),
    legislature integer not null,
    source_id integer not null,
    name text not null,
    party_id bigint not null references public.parties (id),
    unique (chamber, legislature, source_id)
);

comment on column public.mps.source_id is
    'cdep.ro "idm". Only unique together with chamber and legislature.';
comment on column public.mps.party_id is
    'Group at the member''s most recent ballot. ballots.party_id has the group at each vote.';

create table public.votes (
    id bigint primary key,
    sitting_date date not null,
    voted_time time,
    chamber public.chamber not null check (chamber <> 'senate'),
    title text not null,
    is_final boolean not null default false,
    bill_title text,
    bill_url text,
    source_url text not null,
    present integer not null check (present >= 0),
    votes_for integer not null check (votes_for >= 0),
    votes_against integer not null check (votes_against >= 0),
    abstained integer not null check (abstained >= 0),
    not_voted integer not null check (not_voted >= 0),
    result text generated always as (
        case when votes_for > votes_against then 'passed' else 'failed' end
    ) stored
);

comment on column public.votes.id is 'cdep.ro vote id ("idv").';
comment on column public.votes.voted_time is 'Local time; the source omits it for some votes.';
comment on column public.votes.is_final is
    'Final vote on a bill or resolution, as opposed to a procedural vote.';
comment on column public.votes.result is
    'Indicative only: more votes for than against. The source does not publish the outcome, '
    'and some votes need a qualified majority.';

create index votes_sitting_date_idx on public.votes (sitting_date desc, id desc);

create table public.ballots (
    vote_id bigint not null references public.votes (id) on delete cascade,
    mp_id bigint not null references public.mps (id),
    party_id bigint not null references public.parties (id),
    choice public.ballot_choice not null,
    primary key (vote_id, mp_id)
);

comment on column public.ballots.party_id is 'The member''s group at the time of the vote.';

create index ballots_mp_id_idx on public.ballots (mp_id, vote_id desc);
create index ballots_party_id_idx on public.ballots (party_id);

-- Everyone may read; nobody but the service role (which bypasses row level
-- security) may write.

alter table public.parties enable row level security;
alter table public.mps enable row level security;
alter table public.votes enable row level security;
alter table public.ballots enable row level security;

create policy "Public read" on public.parties for select to anon, authenticated using (true);
create policy "Public read" on public.mps for select to anon, authenticated using (true);
create policy "Public read" on public.votes for select to anon, authenticated using (true);
create policy "Public read" on public.ballots for select to anon, authenticated using (true);

revoke all on public.parties, public.mps, public.votes, public.ballots from anon, authenticated;
grant select on public.parties, public.mps, public.votes, public.ballots to anon, authenticated;
grant all on public.parties, public.mps, public.votes, public.ballots to service_role;
