import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaderboardTable } from "./LeaderboardTable";
import { player } from "./fixtures";
import { columns } from "./types";
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getByRole("rowheader").textContent);
it("sorts unrounded values, keeps null last, and supports Enter and Space aria-sort toggles", async () => {
  const c = player("C", 0, 3);
  c.periods.season.metrics.pointsPerGame.value = null;
  render(
    <LeaderboardTable
      players={[player("B", 10.01, 2), c, player("A")]}
      position="WR"
      period="season"
      selectedId="A"
      onSelect={() => {}}
    />,
  );
  expect(screen.getAllByText("10.0")).toHaveLength(2);
  expect(names()).toEqual(["Player ASEA ", "Player BSEA ", "Player CSEA "]);
  const button = screen.getByRole("button", { name: "Points/G" });
  button.focus();
  await userEvent.keyboard("{Enter}");
  expect(button.closest("th")).toHaveAttribute("aria-sort", "ascending");
  expect(names()[0]).toContain("Player B");
  expect(names()[2]).toContain("Player C");
  await userEvent.keyboard(" ");
  expect(button.closest("th")).toHaveAttribute("aria-sort", "descending");
  expect(names()[0]).toContain("Player A");
  expect(names()[2]).toContain("Player C");
});
it.each(["WR", "RB", "TE"] as const)(
  "renders exact %s metric column order and unavailable route cells",
  (position) => {
    render(
      <LeaderboardTable
        players={[player("A")]}
        position={position}
        period="season"
        selectedId="A"
        onSelect={() => {}}
      />,
    );
    expect(
      screen
        .getAllByRole("button")
        .map((b) => b.textContent?.replace(/ [↓↑↕]$/, "")),
    ).toEqual(columns[position].map((c) => c.label));
    if (position !== "RB") expect(screen.getAllByText("—")).toHaveLength(2);
  },
);

it.each(["WR", "RB", "TE"] as const)(
  "%s sorts Delta before rounding, preserves missing values, and renumbers visible rows",
  async (position) => {
    const higherDelta = player("Z-high", 9.951, 1);
    higherDelta.periods.season.metrics.xfpPerGame = { value: 9.85 };
    const lowerDelta = player("A-low", 10.049, 2);
    lowerDelta.periods.season.metrics.xfpPerGame = { value: 9.951 };
    const negative = player("Negative", 8, 3);
    const zero = player("Zero", 0, 4);
    zero.periods.season.metrics.xfpPerGame = { value: 0 };
    const missing = player("Missing", 5, 5);
    missing.periods.season.metrics.xfpPerGame = { value: null };
    const props = {
      players: [higherDelta, lowerDelta, negative, zero, missing],
      position, period: "season" as const, selectedId: "Z-high", onSelect: () => {},
    };
    const { rerender } = render(<LeaderboardTable {...props} />);
    const rows = () => screen.getAllByRole("row").slice(1);
    const ranks = () => rows().map((row) => within(row).getAllByRole("cell")[0].textContent);
    const deltas = () => rows().map((row) => within(row).getAllByRole("cell")[3].textContent);
    expect(screen.getByRole("columnheader", { name: "Rank" })).toBeInTheDocument();
    expect(names()[0]).toContain("A-low");
    const sortDelta = screen.getByRole("button", { name: "Delta" });
    await userEvent.click(sortDelta);
    expect(names().map((name) => name?.split("SEA")[0])).toEqual([
      "Player Z-high", "Player A-low", "Player Zero", "Player Negative", "Player Missing",
    ]);
    expect(deltas()).toEqual(["0.1", "0.1", "0.0", "-3.8", "—"]);
    expect(ranks()).toEqual(["1", "2", "3", "4", "5"]);
    await userEvent.click(sortDelta);
    expect(names()[0]).toContain("Negative");
    expect(names()[4]).toContain("Missing");
    expect(ranks()).toEqual(["1", "2", "3", "4", "5"]);

    // Filter to one player, then switch periods without changing their selection.
    rerender(<LeaderboardTable {...props} search="Z-high" />);
    expect(ranks()).toEqual(["1"]);
    expect(deltas()).toEqual(["0.1"]);
    higherDelta.periods.last4.metrics.xfpPerGame = { value: 15 };
    rerender(<LeaderboardTable {...props} search="Z-high" period="last4" />);
    expect(deltas()).toEqual(["-3.0"]);
    higherDelta.periods.last4.metrics.pointsPerGame.value = null;
    rerender(<LeaderboardTable {...props} search="Z-high" period="last4" />);
    expect(deltas()).toEqual(["—"]);
  },
);
