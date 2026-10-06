export const positions = ["WR", "RB", "TE"] as const;
export type Position = (typeof positions)[number];
export const positionConfig: Record<Position, { label: string; limit: number }> = {
  WR: { label: "Wide receivers", limit: 100 },
  RB: { label: "Running backs", limit: 50 },
  TE: { label: "Tight ends", limit: 25 },
};
export type Period = "season" | "last4";
export type Metric = {
  value: number | null;
  num?: number;
  den?: number;
  endZoneMissingAirYards?: number;
};
export type PeriodAgg = {
  rank: number;
  games: number;
  coveredWeeks: number[];
  metrics: Record<string, Metric>;
  coverage?: Record<string, { covered: number; total: number }>;
};
export type WeekSlot = {
  week: number;
  team: string | null;
  status: "played" | "bye" | "inactive" | "not_on_team";
  injuryStatus?: string;
  upcoming?: boolean;
  pending?: boolean;
  values: Record<string, number | null>;
};
export type Player = {
  playerId: string;
  name: string;
  team: string;
  periods: Record<Period, PeriodAgg>;
  weeks: WeekSlot[];
};
export type PositionFile = {
  meta: {
    season: number;
    position: Position;
    scoring: string;
    dataThroughWeek: number;
    builtAt: string;
    sources: { name: string; updatedAt: string; throughWeek: number }[];
    partial: boolean;
    laggingSources?: string[];
  };
  players: Player[];
};
export type Column = {
  key: string;
  label: string;
  digits: number;
  percent?: boolean;
  help: string;
  unavailable?: boolean;
};
export const routeHelp =
  "Requires charted route data; not available from free sources.";
const common: Column[] = [
  {
    key: "pointsPerGame",
    label: "Points/G",
    digits: 1,
    help: "Actual half-PPR fantasy points divided by games played.",
  },
  {
    key: "xfpPerGame",
    label: "xFP/G",
    digits: 1,
    help: "ffopportunity full-PPR expected points minus 0.5 × expected receptions, summed over included games and divided by games played. See metric notes for the model and calculation.",
  },
  {
    key: "delta",
    label: "Delta",
    digits: 1,
    help: "Actual points per game minus expected points per game (Points/G − xFP/G) for the selected period. Positive values are above expectation; negative values are below.",
  },
];
const targets: Column = {
  key: "targetsPerGame",
  label: "Targets/G",
  digits: 1,
  help: "Pass attempts with a receiver, excluding sacks, divided by games played.",
};
const receivingColumns: Column[] = [
  ...common,
  targets,
  {
    key: "targetShare",
    label: "Target share",
    digits: 1,
    percent: true,
    help: "Player targets divided by all team targets in the included games, including plays off the field.",
  },
  {
    key: "routeParticipation",
    label: "Route %",
    digits: 1,
    percent: true,
    help: routeHelp,
    unavailable: true,
  },
  {
    key: "yardsPerRoute",
    label: "Yards/route",
    digits: 2,
    help: routeHelp,
    unavailable: true,
  },
];
export const columns: Record<Position, Column[]> = {
  WR: receivingColumns,
  TE: receivingColumns,
  RB: [
    ...common,
    {
      key: "carriesPerGame",
      label: "Carries/G",
      digits: 1,
      help: "Rush attempts excluding kneels and two-point tries, divided by games played.",
    },
    targets,
    {
      key: "rbCarryShare",
      label: "RB carry %",
      digits: 1,
      percent: true,
      help: "Player carries divided by carries by season-rostered team RBs and FBs. Excludes QB, WR and TE carries.",
    },
    {
      key: "inside5PerGame",
      label: "Inside-5/G",
      digits: 1,
      help: "Player carries from the opponent’s five-yard line or closer divided by games played.",
    },
  ],
};
export function format(
  value: number | null | undefined,
  digits = 1,
  percent = false,
) {
  return value == null
    ? "—"
    : `${(value * (percent ? 100 : 1)).toFixed(digits)}${percent ? "%" : ""}`;
}
