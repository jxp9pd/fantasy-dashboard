import { useState } from "react";
import type { SeasonBenchmark } from "./benchmarks";
import {
  format,
  type Player,
  type Period,
  type Position,
  type WeekSlot,
} from "./types";
export function WeeklyChart({
  player,
  period,
  position,
  kind,
  benchmarks = [],
}: {
  player: Player;
  period: Period;
  position: Position;
  kind: "scoring" | "role";
  benchmarks?: SeasonBenchmark[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const scoring = kind === "scoring";
  const weeks: WeekSlot[] = Array.from(
    { length: 18 },
    (_, i) =>
      player.weeks.find((w) => w.week === i + 1) ?? {
        week: i + 1,
        team: null,
        status: "not_on_team",
        upcoming: true,
        values: {},
      },
  );
  const keys = scoring
    ? ["actual", "xfp"]
    : [position === "WR" ? "targetShare" : "rbCarryShare"];
  const labels = scoring
    ? ["Actual", "Expected"]
    : [position === "WR" ? "Target share" : "Share of RB carries"];
  const values = weeks.flatMap((w) =>
    w.status === "played"
      ? keys.map((k) => w.values[k]).filter((v): v is number => v != null)
      : [],
  );
  const domainValues = [
    ...values,
    ...benchmarks.map((benchmark) => benchmark.value),
  ];
  const low = scoring ? Math.min(0, ...domainValues) : 0,
    high = scoring
      ? Math.max(10, ...domainValues) * 1.12
      : Math.max(1, ...domainValues);
  const x = (week: number) => 42 + (week - 1) * (438 / 17),
    y = (value: number) => 168 - ((value - low) / (high - low)) * 130;
  const annotation = (w: WeekSlot) =>
    w.pending
      ? "Awaiting data"
      : w.upcoming
        ? "Upcoming"
        : w.status === "bye"
          ? "Bye"
          : w.status === "inactive"
            ? (w.injuryStatus ?? "Inactive")
            : w.status === "not_on_team"
              ? "Not on team"
              : "";
  const description = (w: WeekSlot) =>
    w.status === "played"
      ? `Week ${w.week}: ${scoring ? `${format(w.values.actual)} actual, ${format(w.values.xfp)} expected` : `${format(w.values[keys[0]], 1, true)} ${labels[0].toLowerCase()}`}`
      : `Week ${w.week}: ${annotation(w)}`;
  function path(key: string) {
    let started = false;
    return weeks
      .map((w) => {
        const value = w.status === "played" ? w.values[key] : null;
        if (value == null) {
          started = false;
          return "";
        }
        const command = started ? "L" : "M";
        started = true;
        return `${command}${x(w.week)},${y(value)}`;
      })
      .join(" ");
  }
  return (
    <section
      className="chart-card"
      data-testid={`${kind}-chart`}
      aria-label={`${scoring ? "Scoring" : "Role"} chart`}
    >
      <h3>
        {scoring ? "Scoring" : "Role"} over the season{" "}
        <span>· full season</span>
      </h3>
      <div className="legend">
        {labels.map((label, i) => (
          <span key={label}>
            <i className={i ? "legend-dashed" : "legend-solid"} />
            {label}
          </span>
        ))}
        {!scoring && (
          <span title="Requires charted route data; not available from free sources.">
            Route participation · unavailable
          </span>
        )}
        {benchmarks.map((benchmark) => (
          <span
            key={benchmark.rank}
            title={`${benchmark.rank}th-highest season ${scoring ? "points per game" : labels[0].toLowerCase()}`}
          >
            <i className={`legend-reference-${benchmark.rank}`} />
            {benchmark.label} · {format(benchmark.value, 1, !scoring)}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 500 212"
        role="group"
        aria-label={`${scoring ? "Scoring" : "Role"} over the full season for ${player.name}`}
      >
        <title>{scoring ? "Scoring" : "Role"} over the full season</title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="42"
              x2="480"
              y1={168 - t * 130}
              y2={168 - t * 130}
              className="gridline"
            />
            <text
              x="34"
              y={172 - t * 130}
              textAnchor="end"
              className="axis-label"
            >
              {format(low + t * (high - low), 0, !scoring)}
            </text>
          </g>
        ))}
        {benchmarks.map((benchmark) => (
          <line
            key={benchmark.rank}
            data-benchmark={benchmark.label}
            data-value={benchmark.value}
            x1={x(1)}
            x2={x(18)}
            y1={y(benchmark.value)}
            y2={y(benchmark.value)}
            className={`reference-line reference-${benchmark.rank}`}
            strokeDasharray={benchmark.rank === 10 ? "10 5" : "2 5"}
          >
            <title>
              {benchmark.label}: {format(benchmark.value, 1, !scoring)} ·{" "}
              {benchmark.rank}th-highest season{" "}
              {scoring ? "points per game" : labels[0].toLowerCase()}
            </title>
          </line>
        ))}
        {weeks.map((w) => (
          <g
            key={w.week}
            data-testid="week-slot"
            data-week={w.week}
            data-highlighted={player.periods[period].coveredWeeks.includes(
              w.week,
            )}
          >
            <text
              x={x(w.week)}
              y="191"
              textAnchor="middle"
              className={`axis-label${player.periods[period].coveredWeeks.includes(w.week) ? " selected-week" : ""}`}
            >
              {w.week}
            </text>
            {w.status !== "played" && !w.upcoming && (
              <text
                x={x(w.week)}
                y="158"
                textAnchor="middle"
                className="absence"
                transform={`rotate(-65 ${x(w.week)} 158)`}
              >
                {annotation(w)}
              </text>
            )}
          </g>
        ))}
        {keys.map((key, i) => (
          <path
            key={key}
            data-series={key}
            d={path(key)}
            fill="none"
            className={i ? "series-expected" : "series-primary"}
            strokeDasharray={i ? "6 4" : "none"}
          />
        ))}
        {weeks
          .filter(
            (w) =>
              w.status === "played" && keys.some((k) => w.values[k] != null),
          )
          .map((w) => (
            <g
              key={w.week}
              role="button"
              tabIndex={0}
              aria-label={description(w)}
              onMouseEnter={() => setActive(w.week)}
              onFocus={() => setActive(w.week)}
              onClick={() => setActive(w.week)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive(w.week);
                }
              }}
              className="chart-point"
            >
              <rect
                x={x(w.week) - 12}
                y="38"
                width="24"
                height="130"
                fill="transparent"
              />
              {keys.map(
                (key, i) =>
                  w.values[key] != null && (
                    <circle
                      key={key}
                      cx={x(w.week)}
                      cy={y(w.values[key])}
                      r="3.5"
                      className={i ? "point-expected" : "point-primary"}
                    />
                  ),
              )}
              <title>{description(w)}</title>
            </g>
          ))}
      </svg>
      <div className="chart-readout" role="status">
        {active
          ? description(weeks[active - 1])
          : "Explore a point for weekly values."}
      </div>
      <p className="chart-caption">
        NFL week
        {benchmarks.length > 0 && " · Reference lines use season averages"}
      </p>
      <div className="sr-only">
        <table>
          <caption>
            {scoring ? "Scoring" : "Role"} weekly data · full season
          </caption>
          <thead>
            <tr>
              <th>Week</th>
              <th>Status</th>
              {labels.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <th>{w.week}</th>
                <td>{annotation(w) || "Played"}</td>
                {keys.map((k) => (
                  <td key={k}>
                    {format(
                      w.status === "played" ? w.values[k] : null,
                      1,
                      !scoring,
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
