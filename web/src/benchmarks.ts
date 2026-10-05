import type { Player, Position } from "./types";

export type SeasonBenchmark = {
  rank: 10 | 20;
  label: string;
  value: number;
};

/** Rank each metric independently using the complete position's season data. */
export function seasonBenchmarks(
  players: Player[],
  position: Position,
  kind: "scoring" | "role",
): SeasonBenchmark[] {
  const metric =
    kind === "scoring"
      ? "pointsPerGame"
      : position === "WR"
        ? "targetShare"
        : "rbCarryShare";
  const values = players
    .filter((player) => player.periods.season.games > 0)
    .map((player) => player.periods.season.metrics[metric]?.value)
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => b - a);
  return ([10, 20] as const).flatMap((rank) => {
    const value = values[rank - 1];
    return value === undefined
      ? []
      : [{ rank, label: `${position}${rank}`, value }];
  });
}
