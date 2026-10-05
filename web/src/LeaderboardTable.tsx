import { useState } from "react";
import {
  columns,
  format,
  type Period,
  type Player,
  type Position,
} from "./types";
export function LeaderboardTable({
  players,
  position,
  period,
  selectedId,
  onSelect,
  search = "",
  team = "",
  onSearchChange,
  onTeamChange,
  onClearFilters,
}: {
  players: Player[];
  position: Position;
  period: Period;
  selectedId: string;
  onSelect: (id: string) => void;
  search?: string;
  team?: string;
  onSearchChange?: (value: string) => void;
  onTeamChange?: (value: string) => void;
  onClearFilters?: () => void;
}) {
  const [sort, setSort] = useState({ key: "pointsPerGame", descending: true });
  const limit = position === "WR" ? 100 : 50;
  const normalize = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’‘.]/g, "")
      .toLowerCase();
  const query = normalize(search.trim());
  const filtersActive = Boolean(query || team);
  const teams = [
    ...new Set(
      players
        .map((p) => p.team)
        .filter(Boolean)
        .concat(team ? [team] : []),
    ),
  ].sort();
  const population = players.filter((p) =>
    filtersActive
      ? (!query || normalize(p.name).includes(query)) &&
        (!team || p.team === team)
      : p.periods[period].rank <= limit,
  );
  const selected = players.find((p) => p.playerId === selectedId);
  const pinned =
    !filtersActive && selected && !population.includes(selected)
      ? selected
      : null;
  const ordered = [...population].sort((a, b) => {
    const x = a.periods[period].metrics[sort.key]?.value,
      y = b.periods[period].metrics[sort.key]?.value;
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return (x - y) * (sort.descending ? -1 : 1) || a.name.localeCompare(b.name);
  });
  if (pinned) ordered.unshift(pinned);
  const availability = (player: Player) => {
    const latest = [...player.weeks]
      .filter((w) => !w.upcoming && !w.pending)
      .sort((a, b) => b.week - a.week)[0];
    return latest?.status === "inactive"
      ? (latest.injuryStatus ?? "Inactive")
      : latest?.status === "bye"
        ? "Bye"
        : null;
  };
  const toggle = (key: string) =>
    setSort((s) => ({ key, descending: s.key === key ? !s.descending : true }));
  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <div className="section-heading">
        <h2 id="leaderboard-title">Leaderboard</h2>
        <span>
          {filtersActive ? `All ${position} players` : `Top ${limit}`} ·{" "}
          {period === "season" ? "Season" : "Last 4 games"}
        </span>
      </div>
      {onSearchChange && onTeamChange && (
        <div className="leaderboard-filters">
          <label className="search-filter">
            Search players
            <input
              type="search"
              value={search}
              placeholder="Player name"
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </label>
          <label className="team-filter">
            Team
            <select
              title="Filter by each player's most recent team"
              value={team}
              onChange={(e) => onTeamChange(e.target.value)}
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {filtersActive && (
            <button className="clear-filters" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
          <span className="filter-count" role="status">
            {ordered.length}{" "}
            {filtersActive
              ? ordered.length === 1
                ? "result"
                : "results"
              : ordered.length === 1
                ? "player"
                : "players"}
          </span>
        </div>
      )}
      <div
        className="table-scroll"
        role="region"
        aria-label="Player leaderboard"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Player</th>
              {columns[position].map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sort.key === c.key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    title={c.help}
                    aria-describedby={`help-${c.key}`}
                    onClick={() => toggle(c.key)}
                  >
                    {c.label}
                    <span aria-hidden="true">
                      {sort.key === c.key
                        ? sort.descending
                          ? " ↓"
                          : " ↑"
                        : " ↕"}
                    </span>
                  </button>
                  <span className="sr-only" id={`help-${c.key}`}>
                    {c.help}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!ordered.length && (
              <tr>
                <td
                  className="no-matches"
                  colSpan={columns[position].length + 1}
                >
                  No players match these filters.
                </td>
              </tr>
            )}
            {ordered.map((p) => (
              <tr
                key={p.playerId}
                tabIndex={0}
                aria-selected={selectedId === p.playerId}
                onClick={() => onSelect(p.playerId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.playerId);
                  }
                }}
              >
                <th scope="row">
                  <span className="player-name">{p.name}</span>
                  <span className="player-team">
                    {p.team}{" "}
                    {availability(p) && (
                      <span className="availability"> · {availability(p)}</span>
                    )}
                    {p === pinned && (
                      <span className="pin">Outside top {limit} · pinned</span>
                    )}
                  </span>
                </th>
                {columns[position].map((c) => (
                  <td key={c.key} title={c.unavailable ? c.help : undefined}>
                    {format(
                      c.unavailable
                        ? null
                        : p.periods[period].metrics[c.key]?.value,
                      c.digits,
                      c.percent,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
