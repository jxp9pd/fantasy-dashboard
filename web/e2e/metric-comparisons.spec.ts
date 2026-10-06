import AxeBuilder from "@axe-core/playwright";
import { test, expect, positionFixture } from "./fixtures";

for (const position of ["WR", "RB", "TE"] as const) {
  test(`${position} percentile bars follow period and player while retaining the full population`, async ({ page }) => {
    const data = positionFixture(position);
    data.players = Array.from({ length: 6 }, (_, index) => {
      const p = structuredClone(data.players[0]);
      p.playerId = `comparison-${index}`;
      p.name = `Comparison Player ${index}`;
      p.periods.season.rank = 6 - index;
      p.periods.last4.rank = 6 - index;
      for (const period of ["season", "last4"] as const) {
        const factor = period === "season" ? 1 : 0.5;
        p.periods[period].metrics.inside5Share = { value: index / 5 * factor, num: index * factor * 2, den: 10 };
        p.periods[period].metrics.yardsAfterContactPerCarry = { value: index * factor, num: index * factor * 30, den: 30 };
        p.periods[period].metrics.endZoneTargetsPerGame = { value: index * factor, num: index * factor * 4, den: 4 };
      }
      return p;
    });
    await page.route(`**/data/${position.toLowerCase()}.json`, (route) => route.fulfill({ json: data }));
    await page.goto(`?position=${position.toLowerCase()}`);
    const metric = position === "RB" ? "inside5Share" : "endZoneTargetsPerGame";
    const chart = page.getByTestId(`comparison-${metric}`);
    await chart.scrollIntoViewIfNeeded();
    await expect(chart.getByRole("listitem")).toHaveCount(5);
    await expect(chart.getByText(`6 qualifying ${position}s · Season`)).toBeVisible();
    const benchmarks = () => chart.locator('[data-comparison]:not([data-comparison="Player"])').evaluateAll((rows) => rows.map(r => Number(r.getAttribute("data-value"))));
    const before = await benchmarks();
    const search = page.getByRole("searchbox", { name: "Search players" });
    await search.fill("Player 0");
    await expect(page.getByRole("region", { name: "Player leaderboard" }).getByRole("rowheader")).toHaveCount(1);
    expect(await benchmarks()).toEqual(before);
    await page.getByRole("region", { name: "Player leaderboard" }).getByRole("row").filter({ hasText: "Comparison Player 0" }).click();
    await expect(chart.locator('[data-comparison="Player"]')).toHaveAttribute("data-value", "0");
    expect(await benchmarks()).toEqual(before);
    await page.getByRole("button", { name: "Last 4 games", exact: true }).click();
    await expect(chart.getByText(`6 qualifying ${position}s · Last 4 games`)).toBeVisible();
    const after = await benchmarks();
    after.forEach((value, index) => expect(value).toBeCloseTo(before[index] / 2));
    const barsFit = await page.locator(".comparison-bars li").evaluateAll(rows => rows.every(row => {
      const track = row.querySelector(".comparison-track")!.getBoundingClientRect();
      const bar = row.querySelector(".comparison-bar")?.getBoundingClientRect();
      const value = row.querySelector(".comparison-value")!.getBoundingClientRect();
      return track.right <= value.left && (!bar || (bar.left >= track.left - 1 && bar.right <= track.right + 1));
    }));
    expect(barsFit).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  });
}
