import {
  format,
  routeHelp,
  type Period,
  type Player,
  type Position,
} from "./types";
import { WeeklyChart } from "./WeeklyChart";
import { seasonBenchmarks } from "./benchmarks";
import { MetricComparison } from "./MetricComparison";
import type { ComparisonMetric } from "./metricComparisons";
export function SupportingMetrics({
  player,
  players = [],
  position,
  period,
}: {
  player: Player;
  players?: Player[];
  position: Position;
  period: Period;
}) {
  const agg = player.periods[period],
    m = agg.metrics;
  const ez = m.endZoneTargetsPerGame,
    inside = m.inside5Share,
    yac = m.yardsAfterContactPerCarry,
    coverage = agg.coverage?.yardsAfterContactPerCarry;
  const entries: {
    label: string;
    value: string;
    help: string;
    context: string;
    comparison?: ComparisonMetric;
  }[] =
    position === "WR"
      ? [
          {
            label: "Targets per route run",
            value: "—",
            help: routeHelp,
            context: "Routes run unavailable",
          },
          {
            label: "End-zone targets/G",
            comparison: "endZoneTargetsPerGame",
            value: format(ez?.value),
            help: "Targets with air yards at least the distance to the goal line, divided by games played.",
            context: `${ez?.num ?? 0} end-zone targets${m.endZoneMissingAirYards?.value ? ` · ${m.endZoneMissingAirYards.value} targets excluded: missing air yards` : ""}`,
          },
          {
            label: "First downs per route run",
            value: "—",
            help: routeHelp,
            context: "Routes run unavailable",
          },
        ]
      : [
          {
            label: "Route participation",
            value: "—",
            help: routeHelp,
            context: "Routes run unavailable",
          },
          {
            label: "Share of team carries inside the five",
            comparison: "inside5Share",
            value: format(inside?.value, 1, true),
            help: "Player inside-five carries divided by all team inside-five carries, including QBs; excludes kneels and two-point tries.",
            context: `${inside?.num ?? 0} of ${inside?.den ?? 0} team attempts`,
          },
          {
            label: "Rushing yards after contact per carry",
            comparison: "yardsAfterContactPerCarry",
            value: format(yac?.value),
            help: "Yards after first contact divided by charted carries, using only games covered by PFR advanced rushing.",
            context: `${yac?.den ?? 0} charted carries${coverage ? ` · ${coverage.covered} of ${coverage.total} games covered` : " · Coverage unavailable"}`,
          },
        ];
  return (
    <section className={`supporting supporting-${position.toLowerCase()}`} aria-label="Supporting metrics">
      {[...entries].sort((a, b) => Number(!!b.comparison) - Number(!!a.comparison)).map((e) => (
        <div className={`metric-card${e.comparison ? " metric-with-comparison" : " metric-unavailable"}`} key={e.label}>
          <h3 title={e.help}>
            {e.label}
            <span className="sr-only">. {e.help}</span>
          </h3>
          <strong title={e.value === "—" ? e.help : undefined}>
            {e.value}
          </strong>
          <p>{e.context}</p>
          {e.comparison && (
            <MetricComparison
              player={player}
              players={players}
              position={position}
              period={period}
              metric={e.comparison}
              label={e.label}
            />
          )}
        </div>
      ))}
    </section>
  );
}
export function PlayerDetail({
  player,
  players = [],
  position,
  period,
}: {
  player: Player;
  players?: Player[];
  position: Position;
  period: Period;
}) {
  const agg = player.periods[period];
  const total = (key: string) =>
    agg.metrics[key]?.num ?? (agg.metrics[key]?.value ?? 0) * agg.games;
  return (
    <section
      className="player-detail"
      aria-label="Player detail"
      data-testid="player-detail"
    >
      <header className="detail-header">
        <div>
          <h2>
            {player.name} <span>{player.team}</span>
          </h2>
          <p>
            <span>{period === "season" ? "Season" : "Last 4 games"} · </span>
            <span>Weeks {agg.coveredWeeks.join(", ") || "—"}</span>
          </p>
        </div>
        <p className="sample-size">
          <strong>{agg.games}</strong> games played <span>·</span>{" "}
          {position === "WR"
            ? "— routes run"
            : `${format(total("carriesPerGame"), 0)} carries`}{" "}
          <span>·</span> {format(total("targetsPerGame"), 0)} targets
        </p>
      </header>
      <div className="charts">
        <WeeklyChart
          player={player}
          period={period}
          position={position}
          kind="scoring"
          benchmarks={seasonBenchmarks(players, position, "scoring")}
        />
        <WeeklyChart
          player={player}
          period={period}
          position={position}
          kind="role"
          benchmarks={seasonBenchmarks(players, position, "role")}
        />
      </div>
      <SupportingMetrics player={player} players={players} position={position} period={period} />
    </section>
  );
}
