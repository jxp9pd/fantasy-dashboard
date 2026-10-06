import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { snapshot } from "./fixtures";
import { PlayerDetail, SupportingMetrics } from "./PlayerDetail";
beforeEach(() => window.history.replaceState({}, "", "/"));
it("preserves selected player through sorting and pins after a period change; keyboard selects", async () => {
  const data = snapshot();
  data.players[1].periods.last4.rank = 101;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "Leaderboard" });
  const row = screen.getByText("Player B").closest("tr")!;
  row.focus();
  await userEvent.keyboard(" ");
  expect(row).toHaveAttribute("aria-selected", "true");
  expect(
    within(screen.getByTestId("player-detail")).getByRole("heading", {
      name: "Player B SEA",
    }),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Points/G" }));
  expect(row).toHaveAttribute("aria-selected", "true");
  await userEvent.click(screen.getByRole("button", { name: "Last 4 games" }));
  expect(screen.getByText(/Outside top 100/)).toBeInTheDocument();
  expect(window.location.search).toContain("period=last4");
  expect(screen.getByText("Weeks 1, 2, 4, 5")).toBeInTheDocument();
  expect(within(row).getByText("12.0")).toBeInTheDocument();
});
it("period changes population and preserves period when navigating WR to RB", async () => {
  const data = snapshot();
  data.players[1].periods.season.rank = 101;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "Leaderboard" });
  expect(screen.queryByText("Player B")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Last 4 games" }));
  expect(screen.getByText("Player B")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "Running backs" }));
  await waitFor(() => expect(window.location.search).toContain("position=rb"));
  expect(window.location.search).toContain("period=last4");
});
it("shows correct WR and RB samples and supporting opportunity coverage", () => {
  const data = snapshot();
  const { rerender } = render(
    <PlayerDetail player={data.players[0]} position="WR" period="season" />,
  );
  expect(screen.getByText(/— routes run/)).toBeInTheDocument();
  expect(screen.getAllByText("1.3")).toHaveLength(2);
  expect(
    screen.getByText(/5 end-zone targets · 2 targets excluded/),
  ).toBeInTheDocument();
  rerender(
    <PlayerDetail player={data.players[0]} position="RB" period="season" />,
  );
  expect(screen.getByText(/32 carries/)).toBeInTheDocument();
  expect(screen.getAllByText("42.9%")).toHaveLength(2);
  expect(screen.getByText("6 of 14 team attempts")).toBeInTheDocument();
  expect(screen.getByText(/3 of 4 games covered/)).toBeInTheDocument();
});
it("renders zero-denominator supporting rate as missing", () => {
  const p = snapshot().players[0];
  p.periods.season.metrics.inside5Share = { value: null, num: 0, den: 0 };
  render(<SupportingMetrics player={p} position="RB" period="season" />);
  expect(screen.getByTestId("comparison-inside5Share").querySelector('[data-comparison="Player"]')).toHaveAttribute("data-value", "");
  expect(screen.getByText("Player value unavailable for this period.")).toBeInTheDocument();
});
