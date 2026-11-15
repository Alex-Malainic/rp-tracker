Romanian Parliament Vote Tracker – Project Plan
This document is a handover brief for an AI coding assistant working inside PyCharm or VS Code with access to the repository and the web. It captures everything agreed in the planning conversation. Read it fully before writing code.
Purpose
A public showcase project for job interviews. The owner is a Python full-stack developer with FastAPI and AWS experience. The project tracks how the Romanian Parliament votes, updated daily, with charts. The repository itself is part of the showcase: it must demonstrate clean code, tests and CI, and must not be used as a data store.
Decisions already made
• Frontend: React (Vite), hosted on GitHub Pages. Reads data directly from Supabase.
• Database: Supabase (free tier Postgres). Public read access through row-level security policies; writes only with the service-role key from CI.
• Ingestion: Python, in its own package, run daily by a GitHub Action that writes into Supabase. No data files are committed to the repo.
• FastAPI: code lives in the same repo as the ingestion and admin service, but is not deployed in phase one. GitHub Pages cannot host it and free hosts sleep, which conflicts with the always-up requirement.
• Terraform and AWS: deferred to phase two. The ingestion package must be designed so it can be wrapped in FastAPI and deployed later without a rewrite.
• Phase two ideas: user login, subscribing to a party or MP to follow their votes, FastAPI deployed on AWS (Lambda + API Gateway) via Terraform with GitHub Actions and OIDC.
Step 0 – Validate the data source (do this first)
This is the only real unknown. Nothing else should be built until it is settled.
1.  Investigate the Chamber of Deputies site (cdep.ro). It is believed to publish electronic vote results per sitting day, including each deputy's vote, as XML or HTML. Find the actual URLs and formats. Also check the Senate (senat.ro) and data.gov.ro for alternatives.
2.  Write a small script in ingestion/ that fetches one sitting day and prints the votes: vote id, date, subject, and for each deputy their name, party group and choice (for, against, abstain, absent).
3.  Run it for a few different days. Note any format inconsistencies, encoding problems or rate limits.
4.  Record findings in docs/data-source.md: URLs, fields, quirks, and how often data appears.
If the per-deputy data is unavailable, stop and report back before continuing.
Step 1 – Repository layout
frontend/          React + Vite, chart library (Recharts or similar)
ingestion/         Python package: fetch, parse, load into Supabase
api/               FastAPI app (phase one: code and tests only, not deployed)
supabase/          SQL migrations, RLS policies
docs/              architecture, data-source notes, decisions
.github/workflows/
  ci.yml           lint + tests for Python and frontend on every PR
  ingest.yml       daily schedule: run ingestion into Supabase
  pages.yml        build and deploy frontend to GitHub Pages
README.md
Keep it simple. One pyproject.toml at the root for the Python packages, ruff for linting, pytest for tests.
Step 2 – Data model (Supabase)
Tables, minimum viable:
• parties – id, name, abbreviation
• mps – id, name, party_id, chamber, active_from, active_to
• votes – id, date, title, description, source_url, result
• ballots – vote_id, mp_id, choice (for / against / abstain / absent)
Rules:
• Ingestion must be idempotent: re-running for the same day must not duplicate rows (use natural keys and upserts).
• Enable RLS. Anonymous role: select only. Writes only through the service-role key, stored as a GitHub secret.
• Add a few SQL views for the charts (party cohesion per month, party similarity, MP attendance) so the frontend does not compute heavy aggregates.
Step 3 – Ingestion package
• Modules: fetch.py (HTTP, retries, polite delay), parse.py (source format to plain dataclasses), load.py (upserts into Supabase), cli.py (run for a date or date range).
• Pure functions in parse.py with unit tests using saved sample files in tests/fixtures/.
• Configuration via environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY.
• Log clearly; fail loudly if the source format changes.
Step 4 – GitHub Actions
• ci.yml: ruff, pytest, frontend lint and build, on push and PR.
• ingest.yml: cron once a day (after sittings, e.g. 22:00 Europe/Bucharest), plus manual trigger with a date input. Runs the CLI with secrets. Open an issue or fail visibly if ingestion errors.
• pages.yml: build the frontend with the public Supabase URL and anon key as build-time variables, deploy to GitHub Pages.
Step 5 – Frontend
Three views to start:
1.  Overview – latest votes list with result and date, filterable by party.
2.  Parties – cohesion over time (how often members vote with their group) and a party similarity heatmap.
3.  MP page – attendance, votes against their own group, recent ballots.
Use the Supabase JS client with the anon key. Keep components small; no state library unless needed. Romanian and English labels are both fine; pick one and be consistent.
Step 6 – FastAPI (code only in phase one)
• Thin app in api/ that imports the ingestion package and exposes: POST /ingest/{date}, GET /health, and read endpoints mirroring the frontend's needs.
• Dockerfile and tests included, so phase two is just deployment.
Step 7 – README and docs
• Architecture diagram (Mermaid is fine), what runs where, and why: Pages for the frontend, Supabase for data, Actions for ingestion, FastAPI reserved for phase two.
• Trade-offs section: why no deployed backend yet, why Supabase, why daily cron.
• Local setup instructions and a link to the live site.
Phase two (not now)
• Supabase Auth for login; subscriptions table; email or in-app notifications when a followed party or MP votes.
• Deploy FastAPI to AWS (Lambda + API Gateway, EventBridge schedule for ingestion) with Terraform in infra/, CI running fmt, validate, tflint, terraform test, and OIDC for AWS credentials.
Working agreements for the assistant
• Validate the data source before building anything else.
• Never commit data files or secrets.
• Small commits and PRs with clear messages; the git history is part of the showcase.
• Ask before adding dependencies or services beyond those listed here.