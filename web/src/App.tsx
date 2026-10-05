import { useEffect, useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { PlayerDetail } from "./PlayerDetail";
import type { Period, Position, PositionFile } from "./types";
function locationState() {
  const params = new URLSearchParams(window.location.search);
  return {
    position: (params.get("position")?.toLowerCase() === "rb"
      ? "RB"
      : "WR") as Position,
    period: (params.get("period") === "last4" ? "last4" : "season") as Period,
  };
}
export default function App() {
  const [view, setView] = useState(locationState),
    [data, setData] = useState<PositionFile | null>(null),
    [error, setError] = useState(false),
    [reload, setReload] = useState(0),
    [selected, setSelected] = useState<Partial<Record<Position, string>>>({});
  const { position, period } = view;
  useEffect(() => {
    const handler = () => setView(locationState());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    fetch(`${import.meta.env.BASE_URL}data/${position.toLowerCase()}.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error("Snapshot unavailable");
        return r.json();
      })
      .then((d: PositionFile) => {
        if (!Array.isArray(d.players) || !d.meta)
          throw Error("Invalid snapshot");
        setData(d);
        setSelected((s) => ({
          ...s,
          [position]: d.players.some((p) => p.playerId === s[position])
            ? s[position]
            : [...d.players].sort(
                (a, b) =>
                  a.periods[locationState().period].rank -
                  b.periods[locationState().period].rank,
              )[0]?.playerId,
        }));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [position, reload]);
  const navigate = (next: typeof view) => {
    const params = new URLSearchParams(window.location.search);
    params.set("position", next.position.toLowerCase());
    params.set("period", next.period);
    window.history.pushState({}, "", `${window.location.pathname}?${params}`);
    setView(next);
  };
  const selectedPlayer = data?.players.find(
    (p) => p.playerId === selected[position],
  );
  const lagging =
    data?.meta.laggingSources ??
    data?.meta.sources
      .filter(
        (s) =>
          s.throughWeek <
          Math.max(...data.meta.sources.map((source) => source.throughWeek)),
      )
      .map((s) => s.name) ??
    [];
  return (
    <div className="app-shell">
      <header className="page-header">
        <nav aria-label="Positions">
          {(["WR", "RB"] as Position[]).map((p) => (
            <a
              key={p}
              href={`?position=${p.toLowerCase()}&period=${period}`}
              aria-current={p === position ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate({ ...view, position: p });
              }}
            >
              {p === "WR" ? "Wide receivers" : "Running backs"}
            </a>
          ))}
        </nav>
        <div className="title-row">
          <div>
            <h1>{position === "WR" ? "Wide receivers" : "Running backs"}</h1>
          </div>
          <div
            className="period-controls"
            role="group"
            aria-label="Summary period"
          >
            {(["season", "last4"] as Period[]).map((p) => (
              <button
                key={p}
                aria-pressed={p === period}
                onClick={() => navigate({ ...view, period: p })}
              >
                {p === "season" ? "Season" : "Last 4 games"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main>
        {!data && !error && (
          <div className="state" role="status">
            Loading player data…
          </div>
        )}
        {error && (
          <div className="state" role="alert">
            <h2>Player data could not be loaded</h2>
            <p>The latest snapshot is unavailable. Try again in a moment.</p>
            <button onClick={() => setReload((v) => v + 1)}>Retry</button>
          </div>
        )}
        {data && (
          <>
            {!data.players.length ? (
              <div className="state">
                <h2>No completed-game results yet</h2>
                <p>
                  Player averages will appear after source data for completed
                  games is available.
                </p>
              </div>
            ) : (
              <>
                <LeaderboardTable
                  players={data.players}
                  position={position}
                  period={period}
                  selectedId={selected[position] ?? ""}
                  onSelect={(id) =>
                    setSelected((s) => ({ ...s, [position]: id }))
                  }
                />
                {selectedPlayer && (
                  <PlayerDetail
                    key={selectedPlayer.playerId}
                    player={selectedPlayer}
                    players={data.players}
                    position={position}
                    period={period}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
      <footer>
        {data && (
          <details className="data-details">
            <summary>Data details</summary>
            <p>
              {data.meta.season} · {data.meta.scoring} · Data through week{" "}
              {data.meta.dataThroughWeek}
            </p>
            <p>
              Last refreshed{" "}
              <time dateTime={data.meta.builtAt}>
                {new Date(data.meta.builtAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </p>
            {data.meta.partial && (
              <p>
                Awaiting updates from{" "}
                {lagging.join(", ") || "one or more sources"}.
              </p>
            )}
            {Date.now() - Date.parse(data.meta.builtAt) >
              36 * 60 * 60 * 1000 && (
              <p>This snapshot is more than 36 hours old.</p>
            )}
          </details>
        )}
        <p>
          Data: <a href="https://nflverse.nflverse.com/">nflverse</a> ·{" "}
          <a href="https://github.com/ffverse/ffopportunity">
            ffverse/ffopportunity
          </a>{" "}
          · Pro Football Reference via nflverse. CC-BY 4.0.
        </p>
        <a href={`${import.meta.env.BASE_URL}metric-notes.html`}>
          Fantasy football metric notes
        </a>
        <p>
          Expected points describe past opportunity. Regular season, completed
          games only.
        </p>
      </footer>
    </div>
  );
}
