# Fantasy football season monitor

A static, half-PPR season dashboard for NFL wide receivers, running backs, and tight ends. The Python 3.12/DuckDB pipeline downloads free nflverse and ffverse data, builds unrounded player summaries, and publishes JSON consumed by a React/TypeScript interface. The season is a build parameter; the deployed dashboard covers 2026.

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

- Rank numbers the displayed rows from 1 to n, following the current sort and filters (including a pinned selection). Delta is actual Points/G minus xFP/G for the selected period, calculated and sorted before display rounding; it is unavailable if either input is missing.
- Scoring is standard half-PPR with no return touchdowns: 0.5/reception, 0.1/rushing or receiving yard, 6/rushing or receiving touchdown, −2/fumble lost, +2/two-point conversion, 0.04/passing yard, 4/passing touchdown, −2/interception. Actual and expected points use ffopportunity's full-PPR totals minus half the respective reception totals. Expected points describe past opportunity, not a projection.
- A completed appearance counts when a player is active on the weekly roster or records any snaps, including special teams. Zero-opportunity games count. Last 4 means the player's four most recent appearances.
- Shares use summed opportunities over those appearances. Team totals include the full game and follow the player's team each week.
- Carries exclude kneels and two-point tries. RB carry share includes season-rostered RB/FB carries, excluding QB/WR/TE runs. Inside-five team share includes all rushers.
- End-zone targets are pass attempts with a receiver, excluding sacks, where air yards reach the goal line. Missing air yards are excluded and reported.
- Charted routes are unavailable from the free sources and display `—`. Yards after contact uses only PFR charted games and reports coverage.
- Supporting metric bars compare the selected player with P25/P50/P75/P95 of all qualified players at the position in the selected period, independent of table filters. Inside-five share requires 2 games, 20 player carries, and 5 team inside-five attempts; contact yards/carry requires 20 charted carries across 2 covered games; WR/TE end-zone targets/game requires 2 games and 10 targets. Percentiles weight each qualified player equally and interpolate between sorted values; at least 5 qualifiers are required. Zero values remain eligible. Players below the minimum still display their value with a note, and missing values stay `—`.
- Weekly charts always show all 18 regular-season weeks; selected-period week labels are emphasized without background bars. Horizontal WR10/WR20, RB10/RB20, or TE10/TE20 references show the tenth- and twentieth-highest season values for each chart's metric (actual points/game, WR/TE target share, or RB carry share). Each metric is ranked independently across the entire position, and references stay fixed when the summary period changes.
- Name search and the most-recent-team filter combine across all players in the position, including players outside the default top 100 WRs, top 50 RBs, or top 25 TEs. Filters persist across period and position switches. Clearing them restores the default leaderboard and any selected-player pin; filtering does not change the selected detail or full-position chart benchmarks.

The dashboard links to companion [metric notes](web/public/metric-notes.html#expected-points), including the full xFP methodology, provider component formulas, half-PPR conversion, games-played denominator, and a worked example. The provider uses XGBoost models trained on 2006–2020 play-by-play. It does not include an expected-fumble penalty, and its published weekly components are already rounded to two decimals; this app adds no further rounding before display.

## Data and freshness

Sources are nflverse play-by-play, weekly rosters, schedules, snap counts, injuries, PFR advanced rushing via nflverse, and ffverse/ffopportunity expected points. Source release timestamps and week coverage are recorded in each output. Only completed games through the shared source cutoff enter aggregates. The collapsed Data details footer contains season/scoring context, refresh time, and lagging or stale source information; missing charting coverage remains beside its metric.

A failed download or build exits unsuccessfully and preserves the last successful snapshot. Snapshots are staged outside the public directory and published by an atomic symlink swap, so all three position files change together. A failed CI refresh never reaches the deployment job, leaving the published site intact.

## Production hosting

Live dashboard: **https://jpentakalos.com/fantasy-dashboard/**, linked from the site's Tools page. The source is `jxp9pd/fantasy-dashboard`; the static production build is served by nginx on the existing personal-site Hetzner server. Vite uses the `/fantasy-dashboard/` base path. No local computer or application server needs to stay running.

The workflow tests the pipeline, builds current data, reconciles it against the sources, and verifies the frontend and browser interactions before a dependent deployment job runs. It runs on pushes to `main`, manual dispatch, and daily at 13:00 UTC (06:00 Pacific daylight time / 05:00 Pacific standard time). Refresh failures keep the last published release online.

Deployment uses the repository secrets `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`. The dedicated SSH key is restricted to `/usr/local/bin/deploy-fantasy-dashboard.py` as the `fantasy-deploy` user, with forwarding and interactive login disabled. The receiver accepts a compressed static build over stdin, rejects unsafe archives and mismatched WR/RB/TE snapshots, then atomically changes `/var/www/fantasy-dashboard/current`. The most recent five releases and previous hashed frontend assets are retained. The dashboard lives outside the personal-site Git checkout, so normal site deployments cannot erase it.

Server configuration is versioned in [`deploy/`](deploy/README.md). HTML and data snapshots revalidate through Cloudflare so a daily refresh is visible without waiting for the normal static-asset cache expiry.

Data attribution: [nflverse](https://nflverse.nflverse.com/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), [ffverse/ffopportunity](https://github.com/ffverse/ffopportunity) (models and expected-points data under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), and [Pro Football Reference](https://www.pro-football-reference.com/) via nflverse. See each source's licensing and methodology for details.
