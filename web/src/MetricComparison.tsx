import { useId } from "react";
import {
  comparisonRules,
  metricComparison,
  qualifiesForComparison,
  type ComparisonMetric,
} from "./metricComparisons";
import { format, type Period, type Player, type Position } from "./types";

export function MetricComparison({
  player,
  players,
  position,
  period,
  metric,
  label,
}: {
  player: Player;
  players: Player[];
  position: Position;
  period: Period;
  metric: ComparisonMetric;
  label: string;
}) {
  const captionId = useId();
  const agg = player.periods[period];
  const comparison = metricComparison(players, period, metric);
  const rawValue = agg.metrics[metric]?.value;
  const value = rawValue != null && Number.isFinite(rawValue) ? rawValue : null;
  const percent = metric === "inside5Share";
  const rows = [
    ...comparison.benchmarks,
    { label: "Player", value },
  ];
  // Every bar shares a zero baseline; include outlying players in the scale.
  const maximum = percent
    ? 1
    : Math.max(1, ...rows.map((row) => row.value ?? 0));
  return (
    <figure
      className="metric-comparison"
      aria-label={`${label}: ${position} percentile comparison`}
      aria-describedby={captionId}
      data-testid={`comparison-${metric}`}
    >
      <ul className="comparison-bars" aria-label="Metric values">
        {rows.map((row) => (
          <li
            key={row.label}
            className={row.label === "Player" ? "comparison-player" : undefined}
            aria-label={`${row.label === "Player" ? player.name : row.label}: ${row.value == null ? "unavailable" : format(row.value, 1, percent)}`}
            data-comparison={row.label}
            data-value={row.value ?? ""}
          >
            <span className="comparison-label" title={row.label === "Player" ? player.name : `${row.label.slice(1)}th percentile`} aria-hidden="true">{row.label}</span>
            <span className="comparison-track" aria-hidden="true">
              {row.value != null && (
                <span
                  className="comparison-bar"
                  style={{ width: `${Math.max(0, Math.min(100, (row.value / maximum) * 100))}%` }}
                />
              )}
            </span>
            <span className="comparison-value" aria-hidden="true">
              {format(row.value, 1, percent)}
            </span>
          </li>
        ))}
      </ul>
      <figcaption id={captionId}>
        <p className="comparison-population">
          {comparison.count} qualifying {position}s · {period === "season" ? "Season" : "Last 4 games"}
        </p>
        <p>{comparisonRules[metric]}</p>
        {comparison.count < 5 && <p>Percentiles need at least 5 qualifying players.</p>}
        {value != null && !qualifiesForComparison(agg, metric) && (
          <p className="comparison-warning">Player is below the benchmark minimum.</p>
        )}
        {value == null && <p>Player value unavailable for this period.</p>}
      </figcaption>
    </figure>
  );
}
