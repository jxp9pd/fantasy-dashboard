import { render, screen, within } from "@testing-library/react";
import { player } from "./fixtures";
import { metricComparison, qualifiesForComparison } from "./metricComparisons";
import { MetricComparison } from "./MetricComparison";

function population() {
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map((value, i) => {
    const p = player(`${i}`, 1, 200 + i);
    p.periods.season.metrics.inside5Share = { value, num: value * 10, den: 10 };
    p.periods.last4 = structuredClone(p.periods.season);
    p.periods.last4.metrics.inside5Share = { value: value / 2, num: value * 5, den: 10 };
    return p;
  });
}

it("interpolates percentiles over all qualified players, including true zero shares and outside-leaderboard ranks", () => {
  const players = population();
  const before = structuredClone(players);
  const result = metricComparison(players, "season", "inside5Share");
  expect(result.count).toBe(6);
  result.benchmarks.forEach((b, i) => {
    expect(b.value).toBeCloseTo([0.25, 0.5, 0.75, 0.95][i]);
  });
  expect(players).toEqual(before);
  expect(metricComparison(players, "last4", "inside5Share").benchmarks[1].value).toBeCloseTo(0.25);
});

it("excludes tiny samples and missing values without selecting only goal-line scorers", () => {
  const players = population();
  players[1].periods.season.games = 1;
  players[2].periods.season.metrics.carriesPerGame.num = 19;
  players[3].periods.season.metrics.inside5Share.den = 4;
  players[4].periods.season.metrics.inside5Share.value = null;
  players[5].periods.season.metrics.inside5Share.value = NaN;
  const result = metricComparison(players, "season", "inside5Share");
  expect(result.count).toBe(1);
  expect(result.benchmarks.every((b) => b.value === null)).toBe(true);
  expect(qualifiesForComparison(players[0].periods.season, "inside5Share")).toBe(true);
});

it("requires charted carry and game coverage for contact yards, not total carries", () => {
  const agg = player("yac").periods.season;
  agg.metrics.yardsAfterContactPerCarry.den = 19;
  expect(qualifiesForComparison(agg, "yardsAfterContactPerCarry")).toBe(false);
  agg.metrics.yardsAfterContactPerCarry.den = 20;
  agg.coverage!.yardsAfterContactPerCarry.covered = 1;
  expect(qualifiesForComparison(agg, "yardsAfterContactPerCarry")).toBe(false);
  agg.coverage!.yardsAfterContactPerCarry.covered = 2;
  expect(qualifiesForComparison(agg, "yardsAfterContactPerCarry")).toBe(true);
  delete agg.coverage;
  expect(qualifiesForComparison(agg, "yardsAfterContactPerCarry")).toBe(false);
});

it("uses targets and games to qualify WRs, retaining players with zero end-zone targets", () => {
  const agg = player("wr").periods.season;
  agg.metrics.endZoneTargetsPerGame = { value: 0, num: 0 };
  agg.metrics.targetsPerGame.num = 9;
  expect(qualifiesForComparison(agg, "endZoneTargetsPerGame")).toBe(false);
  agg.metrics.targetsPerGame.num = 10;
  expect(qualifiesForComparison(agg, "endZoneTargetsPerGame")).toBe(true);
  agg.games = 1;
  expect(qualifiesForComparison(agg, "endZoneTargetsPerGame")).toBe(false);
});

it("shows the selected player's small sample separately without adding it to the qualified population", () => {
  const players = population();
  const selected = player("Selected");
  selected.periods.season.metrics.carriesPerGame.num = 3;
  render(<MetricComparison player={selected} players={[...players, selected]} position="RB" period="season" metric="inside5Share" label="Inside-five share" />);
  expect(screen.getByText("6 qualifying RBs · Season")).toBeInTheDocument();
  expect(screen.getByText("Player is below the benchmark minimum.")).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: "Player Selected: 42.9%" })).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: "P50: 50.0%" })).toBeInTheDocument();
});

it("keeps zero values distinct from missing ones, and fits players above the reference range", () => {
  const players = population();
  const selected = player("Selected");
  selected.periods.season.metrics.yardsAfterContactPerCarry.value = 8;
  const props = { player: selected, players, position: "RB" as const, period: "season" as const, metric: "yardsAfterContactPerCarry" as const, label: "Contact yards" };
  const { rerender } = render(<MetricComparison {...props} />);
  const row = screen.getByRole("listitem", { name: "Player Selected: 8.0" });
  expect(row.querySelector(".comparison-bar")).toHaveStyle({ width: "100%" });
  selected.periods.season.metrics.yardsAfterContactPerCarry.value = 0;
  rerender(<MetricComparison {...props} />);
  const zero = screen.getByRole("listitem", { name: "Player Selected: 0.0" });
  expect(zero.querySelector(".comparison-bar")).toHaveStyle({ width: "0%" });
  selected.periods.season.metrics.yardsAfterContactPerCarry.value = null;
  rerender(<MetricComparison {...props} />);
  const missing = screen.getByRole("listitem", { name: "Player Selected: unavailable" });
  expect(missing.querySelector(".comparison-bar")).toBeNull();
  expect(within(missing).getByText("—")).toBeInTheDocument();
});
