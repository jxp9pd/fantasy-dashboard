import type { Period, PeriodAgg, Player } from "./types";

export type ComparisonMetric =
  | "inside5Share"
  | "yardsAfterContactPerCarry"
  | "endZoneTargetsPerGame";

export const comparisonRules: Record<ComparisonMetric, string> = {
  inside5Share:
    "Minimum 2 games, 20 player carries and 5 team carries inside the five in the selected period.",
  yardsAfterContactPerCarry:
    "Minimum 20 charted carries across 2 covered games in the selected period.",
  endZoneTargetsPerGame:
    "Minimum 2 games and 10 targets in the selected period.",
};

export function qualifiesForComparison(agg: PeriodAgg, key: ComparisonMetric) {
  const metric = agg.metrics[key];
  if (metric?.value == null || !Number.isFinite(metric.value)) return false;
  if (key === "yardsAfterContactPerCarry") {
    return (
      (metric.den ?? 0) >= 20 &&
      (agg.coverage?.[key]?.covered ?? 0) >= 2
    );
  }
  if (agg.games < 2) return false;
  if (key === "inside5Share") {
    return (
      (agg.metrics.carriesPerGame?.num ?? 0) >= 20 &&
      (metric.den ?? 0) >= 5
    );
  }
  return (agg.metrics.targetsPerGame?.num ?? 0) >= 10;
}

/** Equal weight per qualified player; linear interpolation between sorted values. */
export function metricComparison(
  players: Player[],
  period: Period,
  key: ComparisonMetric,
) {
  const values = players
    .map((player) => player.periods[period])
    .filter((agg) => qualifiesForComparison(agg, key))
    .map((agg) => agg.metrics[key].value as number)
    .sort((a, b) => a - b);
  return {
    count: values.length,
    benchmarks: ([25, 50, 75, 95] as const).map((percentile) => {
      const index = (values.length - 1) * (percentile / 100);
      const lower = Math.floor(index);
      return {
        label: `P${percentile}`,
        value:
          values.length < 5
            ? null
            : values[lower] +
              (values[Math.ceil(index)] - values[lower]) * (index - lower),
      };
    }),
  };
}
