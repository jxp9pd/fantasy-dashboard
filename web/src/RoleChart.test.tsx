import { render, screen, within, fireEvent } from "@testing-library/react";
import { WeeklyChart } from "./WeeklyChart";
import { player } from "./fixtures";
it("keeps zero denominator gaps, unavailable route legend and touch-accessible values", () => {
  const { container } = render(
    <WeeklyChart
      player={player("A")}
      period="season"
      position="WR"
      kind="role"
    />,
  );
  expect(screen.getAllByTestId("week-slot")).toHaveLength(18);
  expect(
    screen.getByText("Route participation · unavailable"),
  ).toBeInTheDocument();
  expect(
    container.querySelector('[data-series="routeParticipation"]'),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: /Week 4:/ })).toBeNull();
  expect(
    container
      .querySelector('[data-series="targetShare"]')
      ?.getAttribute("d")
      ?.match(/M/g)?.length,
  ).toBeGreaterThan(1);
  fireEvent.click(screen.getByRole("button", { name: /Week 5:/ }));
  expect(screen.getByRole("status")).toHaveTextContent("24.0% target share");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
    19,
  );
});
