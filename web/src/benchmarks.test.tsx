import { render, screen, within } from "@testing-library/react";
import { seasonBenchmarks } from "./benchmarks";
import { player } from "./fixtures";
import { PlayerDetail } from "./PlayerDetail";

const population = () =>
  Array.from({ length: 25 }, (_, i) => {
    const p = player(`fixture-${i}`, 30.123 - i, i + 1);
    p.periods.season.metrics.targetShare = { value: i / 100 };
    p.periods.season.metrics.rbCarryShare = { value: i / 50 };
    p.periods.last4.metrics.pointsPerGame = { value: 100 + i };
    return p;
  });

it("ranks each metric independently across season data without rounding or mutating players", () => {
  const players = population();
  expect(seasonBenchmarks(players, "WR", "scoring")).toEqual([
    { rank: 10, label: "WR10", value: 21.123 },
    { rank: 20, label: "WR20", value: 11.123000000000001 },
  ]);
  expect(seasonBenchmarks(players, "WR", "role").map((b) => b.value)).toEqual([
    0.15, 0.05,
  ]);
  expect(seasonBenchmarks(players, "RB", "role").map((b) => b.value)).toEqual([
    0.3, 0.1,
  ]);
  expect(players[0].playerId).toBe("fixture-0");
});

it("omits a reference when fewer than its rank have a valid value", () => {
  const players = population().slice(0, 20);
  players[0].periods.season.metrics.targetShare.value = null;
  players[1].periods.season.metrics.targetShare.value = NaN;
  players[2].periods.season.games = 0;
  expect(seasonBenchmarks(players, "WR", "role")).toEqual([
    { rank: 10, label: "WR10", value: 0.1 },
  ]);
  expect(seasonBenchmarks(players.slice(0, 9), "WR", "role")).toEqual([]);
});

it.each(["WR", "RB"] as const)(
  "keeps %s benchmark values constant across summary periods",
  (position) => {
    const players = population();
    const { rerender } = render(
      <PlayerDetail
        player={players[0]}
        players={players}
        position={position}
        period="season"
      />,
    );
    const scoring = () => within(screen.getByTestId("scoring-chart"));
    const role = () => within(screen.getByTestId("role-chart"));
    expect(scoring().getByText(`${position}10 · 21.1`)).toBeInTheDocument();
    expect(
      role().getByText(
        `${position}10 · ${position === "WR" ? "15.0" : "30.0"}%`,
      ),
    ).toBeInTheDocument();
    rerender(
      <PlayerDetail
        player={players[0]}
        players={players}
        position={position}
        period="last4"
      />,
    );
    expect(scoring().getByText(`${position}10 · 21.1`)).toBeInTheDocument();
    expect(
      role().getByText(
        `${position}20 · ${position === "WR" ? "5.0" : "10.0"}%`,
      ),
    ).toBeInTheDocument();
  },
);
