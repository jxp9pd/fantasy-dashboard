import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";
import { snapshot } from "./fixtures";
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});
it("renders loading state", () => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  render(<App />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading player data");
});
it("renders load error and retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "could not be loaded",
  );
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
it("renders empty data", async () => {
  const d = snapshot();
  d.players = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => d }),
  );
  render(<App />);
  expect(
    await screen.findByText("No completed-game results yet"),
  ).toBeInTheDocument();
});
it("shows header, initial descending order, named partial source, stale state and attribution", async () => {
  const d = snapshot();
  d.meta.partial = true;
  d.meta.laggingSources = ["PFR advanced rushing"];
  d.meta.builtAt = new Date(Date.now() - 37 * 3600000).toISOString();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => d }),
  );
  render(<App />);
  expect(await screen.findByText(/Data through week 5/)).toHaveTextContent(
    "2026",
  );
  expect(
    screen.getByText(/Partial refresh: PFR advanced rushing/),
  ).toBeInTheDocument();
  expect(screen.getByText(/more than 36 hours old/)).toBeInTheDocument();
  expect(
    screen.getByText(/Pro Football Reference via nflverse/),
  ).toBeInTheDocument();
  const table = screen.getByRole("region", { name: "Player leaderboard" });
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Player A");
});
