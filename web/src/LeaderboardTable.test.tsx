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
