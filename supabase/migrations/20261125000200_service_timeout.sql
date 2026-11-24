-- refresh_stats() rebuilds every statistics view and resets members' parties
-- from 600,000+ ballots. That takes longer than Supabase's default statement
-- timeout for API calls, so the role the ingestion job uses gets a longer one.
-- Only the ingestion job uses service_role; anon and authenticated keep their
-- short limits.
alter role service_role set statement_timeout = '5min';

-- Make the API pick up the new setting.
notify pgrst, 'reload config';
