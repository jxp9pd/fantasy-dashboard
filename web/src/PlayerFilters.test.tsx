import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { player, snapshot } from "./fixtures";
import type { Position } from "./types";

beforeEach(() => window.history.replaceState({}, "", "/"));
function setup() {
  const data = snapshot();
  const outside = player("outside", 5, 151);
  outside.name = "D’André Example";
  outside.team = "BAL";
  data.players.push(outside);
  for (let i = 0; i < 20; i++) {
    const filler = player(`unlisted-${i}`, 1 + i / 10, 200 + i);
    filler.name = `Unlisted filler ${i}`;
    data.players.push(filler);
  }
  data.players[1].team = "BAL";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  );
  render(<App />);
  return data;
}
const rows = () =>
  within(
    screen.getByRole("region", { name: "Player leaderboard" }),
  ).queryAllByRole("rowheader");
it("combines team and normalized partial-name search across all players, without changing detail or benchmarks", async () => {
  setup();
  await screen.findByRole("searchbox", { name: "Search players" });
  const before = Array.from(document.querySelectorAll("[data-benchmark]")).map(
    (e) => e.getAttribute("data-value"),
  );
  expect(before).toHaveLength(4);
  expect(rows()).toHaveLength(3);
  expect(screen.getByRole("option", { name: "BAL" })).toBeInTheDocument();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Team" }),
    "BAL",
  );
  await userEvent.type(screen.getByRole("searchbox"), "dandre");
  expect(rows()).toHaveLength(1);
  expect(rows()[0]).toHaveTextContent("D’André Example");
  expect(screen.getByText("1 result")).toBeInTheDocument();
  expect(
    within(screen.getByTestId("player-detail")).getByRole("heading", {
      name: "Player A SEA",
    }),
  ).toBeInTheDocument();
  expect(
    Array.from(document.querySelectorAll("[data-benchmark]")).map((e) =>
      e.getAttribute("data-value"),
    ),
  ).toEqual(before);
  await userEvent.selectOptions(screen.getByRole("combobox"), "SEA");
  expect(rows()).toHaveLength(0);
  expect(
    screen.getByText("No players match these filters."),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(rows()).toHaveLength(3);
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("combobox")).toHaveValue("");
});
it("omits a nonmatching selected player, restores its pinned row on clear, and preserves raw-value sort", async () => {
  setup();
  await screen.findByRole("searchbox");
  await userEvent.click(screen.getByRole("button", { name: "Points/G" }));
  await userEvent.type(screen.getByRole("searchbox"), "example");
  rows()[0].closest("tr")!.focus();
  await userEvent.keyboard("{Enter}");
  expect(rows()[0].closest("tr")).toHaveAttribute("aria-selected", "true");
  await userEvent.clear(screen.getByRole("searchbox"));
  expect(screen.getByText("Outside top 100 · pinned")).toBeInTheDocument();
  await userEvent.type(screen.getByRole("searchbox"), "player");
  expect(rows()).toHaveLength(3);
  expect(rows()[0]).toHaveTextContent("Player C");
  expect(
    screen.queryByText("Outside top 100 · pinned"),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByTestId("player-detail")).getByRole("heading", {
      name: "D’André Example BAL",
    }),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(rows()).toHaveLength(4);
  expect(rows()[0]).toHaveTextContent("D’André Example");
  expect(rows()[1]).toHaveTextContent("Player C");
});
it("keeps both filters through period and position changes", async () => {
  setup();
  await screen.findByRole("searchbox");
  await userEvent.type(screen.getByRole("searchbox"), "PLAYER B");
  await userEvent.selectOptions(screen.getByRole("combobox"), "BAL");
  await userEvent.click(screen.getByRole("button", { name: "Last 4 games" }));
  expect(rows()).toHaveLength(1);
  await userEvent.click(screen.getByRole("link", { name: "Running backs" }));
  await screen.findByRole("searchbox");
  expect(screen.getByRole("searchbox")).toHaveValue("PLAYER B");
  expect(screen.getByRole("combobox")).toHaveValue("BAL");
  expect(rows()).toHaveLength(1);
});

it.each(["WR", "RB", "TE"] as Position[])(
  "%s combines games and total volume from the selected period, without pinning excluded players",
  async (position) => {
    window.history.replaceState({}, "", `/?position=${position.toLowerCase()}`);
    const data = snapshot(position);
    const volumeMetric = position === "RB" ? "carriesPerGame" : "targetsPerGame";
    const volumeLabel = position === "RB" ? "Min. total carries" : "Min. total targets";
    const threshold = position === "RB" ? 30 : 10;
    const outside = player("Outside", 5, 151);
    outside.team = "BAL";
    data.players.push(outside);
    for (const p of data.players) {
      // Deliberately different rates ensure filters use totals, not per-game values.
      p.periods.season.metrics[volumeMetric] = { value: 0.1, num: threshold };
      p.periods.last4.metrics[volumeMetric] = { value: 0.1, num: threshold };
    }
    data.players[0].periods.season.metrics[volumeMetric] = {
      value: 100,
      num: threshold - 1,
    };
    data.players[1].periods.season.games = 1;
    data.players[2].periods.last4.games = 1;
    outside.periods.last4.metrics[volumeMetric].num = 0;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const games = await screen.findByRole("spinbutton", { name: "Min. games played" });
    const volume = screen.getByRole("spinbutton", { name: volumeLabel });
    expect(
      screen.queryByRole("spinbutton", {
        name: position === "RB" ? "Min. total targets" : "Min. total carries",
      }),
    ).not.toBeInTheDocument();
    const benchmarks = () => Array.from(document.querySelectorAll("[data-benchmark]")).map(
      (e) => e.getAttribute("data-value"),
    );
    const before = benchmarks();
    await userEvent.type(games, "2");
    await userEvent.type(volume, String(threshold));
    expect(rows().map((row) => row.textContent)).toEqual([
      "Player CSEA ", "Player OutsideBAL ",
    ]);
    expect(screen.getByText("2 results")).toBeInTheDocument();
    expect(rows().map((row) => row.closest("tr")!.querySelector("td")!.textContent)).toEqual(["1", "2"]);
    expect(
      within(screen.getByTestId("player-detail")).getByRole("heading", { name: "Player A SEA" }),
    ).toBeInTheDocument();
    expect(benchmarks()).toEqual(before);
    await userEvent.type(screen.getByRole("searchbox"), "Outside");
    expect(rows()).toHaveLength(1);
    await userEvent.selectOptions(screen.getByRole("combobox"), "SEA");
    expect(rows()).toHaveLength(0);
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.selectOptions(screen.getByRole("combobox"), "");
    await userEvent.click(screen.getByRole("button", { name: "Last 4 games" }));
    expect(rows().map((row) => row.textContent)).toEqual(["Player ASEA ", "Player BSEA "]);
    expect(games).toHaveValue(2);
    expect(volume).toHaveValue(threshold);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await userEvent.clear(games);
    await userEvent.type(games, "5");
    expect(screen.getByText("No players match these filters.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(games).toHaveValue(null);
    expect(volume).toHaveValue(null);
    expect(rows()).toHaveLength(3);
  },
);

it("remembers separate minimums for each position and clears only the current position", async () => {
  setup();
  const games = () => screen.getByRole("spinbutton", { name: "Min. games played" });
  const targets = () => screen.getByRole("spinbutton", { name: "Min. total targets" });
  await screen.findByRole("spinbutton", { name: "Min. games played" });
  await userEvent.type(games(), "3");
  await userEvent.type(targets(), "12");
  await userEvent.click(screen.getByRole("link", { name: "Running backs" }));
  const carries = await screen.findByRole("spinbutton", { name: "Min. total carries" });
  expect(games()).toHaveValue(null);
  expect(carries).toHaveValue(null);
  await userEvent.type(games(), "2");
  await userEvent.type(carries, "32");
  await userEvent.click(screen.getByRole("link", { name: "Tight ends" }));
  await screen.findByRole("spinbutton", { name: "Min. total targets" });
  expect(games()).toHaveValue(null);
  expect(targets()).toHaveValue(null);
  await userEvent.type(targets(), "10");
  await userEvent.click(screen.getByRole("link", { name: "Wide receivers" }));
  await screen.findByRole("spinbutton", { name: "Min. total targets" });
  expect(games()).toHaveValue(3);
  expect(targets()).toHaveValue(12);
  await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(games()).toHaveValue(null);
  expect(targets()).toHaveValue(null);
  await userEvent.click(screen.getByRole("link", { name: "Running backs" }));
  expect(await screen.findByRole("spinbutton", { name: "Min. total carries" })).toHaveValue(32);
  expect(games()).toHaveValue(2);
});
