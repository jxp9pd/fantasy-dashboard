import { render, screen, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { WeeklyChart } from "./WeeklyChart";
import { player } from "./fixtures";
it("renders all 18 slots, annotations, selected weeks and accessible weekly values", () => {
  const { container } = render(
    <WeeklyChart
      player={player("A")}
      period="last4"
      position="WR"
      kind="scoring"
    />,
  );
  expect(
    screen.getByRole("heading", { name: /full season/ }),
  ).toBeInTheDocument();
  expect(screen.getAllByTestId("week-slot")).toHaveLength(18);
  expect(container.querySelector(".period-highlight")).toBeNull();
  expect(
    screen
      .getAllByTestId("week-slot")
      .filter((e) => e.dataset.highlighted === "true")
      .map((e) => e.dataset.week),
  ).toEqual(["1", "2", "4", "5"]);
  expect(screen.getAllByText("Bye").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Out: hamstring").length).toBeGreaterThan(0);
  expect(
    screen.queryByRole("button", { name: /Week 3:/ }),
  ).not.toBeInTheDocument();
  fireEvent.focus(
    screen.getByRole("button", { name: "Week 5: 14.2 actual, 11.8 expected" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Week 5: 14.2 actual, 11.8 expected",
  );
  expect(container.querySelector('[data-series="actual"]')).toHaveAttribute(
    "stroke-dasharray",
    "none",
  );
  expect(container.querySelector('[data-series="xfp"]')).toHaveAttribute(
    "stroke-dasharray",
    "6 4",
  );
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
    19,
  );
});

it("draws fixed, full-width season benchmarks and scales to keep them visible", () => {
  const benchmarks = [
    { rank: 10 as const, label: "WR10", value: 40.123 },
    { rank: 20 as const, label: "WR20", value: 30.456 },
  ];
  const { container, rerender } = render(
    <WeeklyChart
      player={player("A")}
      period="season"
      position="WR"
      kind="scoring"
      benchmarks={benchmarks}
    />,
  );
  const line = container.querySelector('[data-benchmark="WR10"]')!;
  expect(line.getAttribute("y1")).toBe(line.getAttribute("y2"));
  expect(Number(line.getAttribute("y1"))).toBeGreaterThanOrEqual(38);
  expect(Number(line.getAttribute("y1"))).toBeLessThanOrEqual(168);
  expect(line.getAttribute("x1")).toBe("42");
  expect(line.getAttribute("x2")).toBe("480");
  expect(screen.getByText("WR10 · 40.1")).toBeInTheDocument();
  expect(line.getAttribute("stroke-dasharray")).not.toBe(
    container
      .querySelector('[data-benchmark="WR20"]')!
      .getAttribute("stroke-dasharray"),
  );
  const y = line.getAttribute("y1");
  rerender(
    <WeeklyChart
      player={player("A")}
      period="last4"
      position="WR"
      kind="scoring"
      benchmarks={benchmarks}
    />,
  );
  expect(container.querySelector('[data-benchmark="WR10"]')).toHaveAttribute(
    "y1",
    y,
  );
});
