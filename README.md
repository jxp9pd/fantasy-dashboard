# Fantasy football season monitor

A static, half-PPR season dashboard for NFL wide receivers and running backs. The Python 3.12/DuckDB pipeline downloads free nflverse and ffverse data, builds unrounded player summaries, and publishes JSON consumed by a React/TypeScript interface. The season is a build parameter; the deployed dashboard covers 2026.

## Run locally

```sh
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m pipeline.build --season 2026 --out web/public/data
cd web
npm ci
npm run dev
```

Open the local Vite URL with `/fantasy-dashboard/`. Downloaded source files are cached in `data/raw/`; raw data and generated JSON are excluded from Git. The interface does not invent a dataset when a download fails.

## Verify

```sh
.venv/bin/pytest
cd web
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run e2e
```

Default Python tests use small fixtures and never the network. Playwright serves the production build and intercepts data requests with labeled test fixtures, checking desktop and mobile layout, keyboard/touch interactions, and accessibility. Live-source validation is separate from the deterministic suites.

After a live build, run `.venv/bin/pytest -m realdata` to reconcile player totals and PFR coverage against the downloaded sources. The first-four-week end-zone target sanity check skips until all four weeks are covered.

## Definitions

- Scoring is standard half-PPR with no return touchdowns: 0.5/reception, 0.1/rushing or receiving yard, 6/rushing or receiving touchdown, −2/fumble lost, +2/two-point conversion, 0.04/passing yard, 4/passing touchdown, −2/interception. Actual and expected points use ffopportunity's full-PPR totals minus half the respective reception totals. Expected points describe past opportunity, not a projection.
- A completed appearance counts when a player is active on the weekly roster or records any snaps, including special teams. Zero-opportunity games count. Last 4 means the player's four most recent appearances.
- Shares use summed opportunities over those appearances. Team totals include the full game and follow the player's team each week.
- Carries exclude kneels and two-point tries. RB carry share includes season-rostered RB/FB carries, excluding QB/WR/TE runs. Inside-five team share includes all rushers.
- End-zone targets are pass attempts with a receiver, excluding sacks, where air yards reach the goal line. Missing air yards are excluded and reported.
- Charted routes are unavailable from the free sources and display `—`. Yards after contact uses only PFR charted games and reports coverage.
- Weekly charts always show all 18 regular-season weeks; selected-period appearances are highlighted.

The dashboard links to companion [metric notes](web/public/metric-notes.html). Interpretation stays there; metric help in the dashboard describes calculations and denominators.

## Data and freshness

Sources are nflverse play-by-play, weekly rosters, schedules, snap counts, injuries, PFR advanced rushing via nflverse, and ffverse/ffopportunity expected points. Source release timestamps and week coverage are recorded in each output. Only completed games through the shared source cutoff enter aggregates. The interface identifies lagging feeds, missing charting coverage, and snapshots older than 36 hours.

A failed download or build exits unsuccessfully and preserves the last successful snapshot. Snapshots are staged outside the public directory and published by an atomic symlink swap, so both position files change together. A failed CI refresh never reaches the deployment job, leaving the published site intact.

## GitHub Pages

Target: `jxp9pd/fantasy-dashboard`, a public repository with Pages source set to **GitHub Actions**. Vite uses the `/fantasy-dashboard/` base path. The workflow tests the pipeline, builds current data, verifies the frontend and browser interactions, then deploys via a dependent job. It runs on pushes to `main`, manual dispatch, and daily at 13:00 UTC (06:00 Pacific daylight time / 05:00 Pacific standard time).

Data attribution: [nflverse](https://nflverse.nflverse.com/), [ffverse/ffopportunity](https://github.com/ffverse/ffopportunity), and [Pro Football Reference](https://www.pro-football-reference.com/) via nflverse. Data is attributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see each source's licensing and methodology for details.
