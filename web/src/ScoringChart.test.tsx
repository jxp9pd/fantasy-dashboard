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
