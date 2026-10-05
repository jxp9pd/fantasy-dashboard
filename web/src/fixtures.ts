import type { Player, PositionFile, Position } from "./types";
export function player(id: string, points = 10.04, rank = 1): Player {
  return {
    playerId: id,
    name: `Player ${id}`,
    team: "SEA",
    periods: {
      season: {
        rank,
        games: 4,
        coveredWeeks: [1, 2, 4, 5],
        metrics: {
          pointsPerGame: { value: points, num: points * 4 },
          xfpPerGame: { value: 11.8 },
          targetsPerGame: { value: 3, num: 12 },
          carriesPerGame: { value: 8, num: 32 },
          targetShare: { value: 0.24, num: 12, den: 50 },
          routeParticipation: { value: null },
          yardsPerRoute: { value: null },
          rbCarryShare: { value: 0.6 },
          inside5PerGame: { value: 1.5 },
          endZoneTargetsPerGame: { value: 1.25, num: 5 },
          endZoneMissingAirYards: { value: 2 },
          inside5Share: { value: 6 / 14, num: 6, den: 14 },
          yardsAfterContactPerCarry: { value: 2.7, num: 81, den: 30 },
        },
        coverage: { yardsAfterContactPerCarry: { covered: 3, total: 4 } },
      },
      last4: {
        rank,
        games: 4,
        coveredWeeks: [1, 2, 4, 5],
        metrics: {
          pointsPerGame: { value: points + 2 },
          targetsPerGame: { value: 3, num: 12 },
          carriesPerGame: { value: 8, num: 32 },
        },
      },
    },
    weeks: Array.from({ length: 18 }, (_, i) => ({
      week: i + 1,
      team: "SEA",
      status: i === 2 ? "bye" : i === 5 ? "inactive" : "played",
      ...(i === 5 ? { injuryStatus: "Out: hamstring" } : {}),
      values: {
        actual: i === 4 ? 14.2 : 10,
        xfp: 11.8,
        targetShare: i === 3 ? null : 0.24,
        rbCarryShare: 0.6,
        routeParticipation: null,
      },
    })),
  };
}
export function snapshot(position: Position = "WR"): PositionFile {
  return {
    meta: {
      season: 2026,
      position,
      scoring: "Half-PPR · standard scoring, no return TDs",
      dataThroughWeek: 5,
      builtAt: new Date().toISOString(),
      partial: false,
      sources: [],
    },
    players: [player("A"), player("B", 10.01, 2), player("C", 8, 3)],
  };
}
