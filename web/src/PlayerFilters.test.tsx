import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { player, snapshot } from "./fixtures";

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
