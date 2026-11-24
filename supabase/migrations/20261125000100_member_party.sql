-- A member's current party is the group they belonged to on their most
-- recent vote. The loader sets mps.party_id from the batch it is loading, so
-- loading months out of order (a backfill, a rerun) left members with an old
-- group. refresh_stats() now recomputes it from the ballots, so load order no
-- longer matters.

create or replace function public.refresh_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.mps m
    set party_id = latest.party_id
    from (
        select distinct on (b.mp_id) b.mp_id, b.party_id
        from public.ballots b
        order by b.mp_id, b.vote_id desc
    ) latest
    where latest.mp_id = m.id
      and m.party_id is distinct from latest.party_id;

    refresh materialized view public.party_vote_positions;
    refresh materialized view public.party_cohesion_monthly;
    refresh materialized view public.party_similarity;
    refresh materialized view public.mp_attendance;
    refresh materialized view public.constituency_stats;
    refresh materialized view public.constituency_vote_tallies;
end;
$$;

revoke all on function public.refresh_stats() from public, anon, authenticated;
grant execute on function public.refresh_stats() to service_role;
