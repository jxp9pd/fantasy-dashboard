import AxeBuilder from "@axe-core/playwright";
import { test, expect, positionFixture } from "./fixtures";

for (const position of ["WR", "RB"] as const) {
  test(`${position} season reference lines stay fixed and fit both chart layouts`, async ({
    page,
  }) => {
    const data = positionFixture(position);
    const original = data.players[0];
    data.players = Array.from({ length: 24 }, (_, index) => {
      const player = structuredClone(original);
      player.playerId = `benchmark-${index}`;
      player.name = `Fixture benchmark ${index + 1}`;
      player.periods.season.rank = index + 1;
      player.periods.last4.rank = 24 - index;
      player.periods.season.metrics.pointsPerGame.value = 30 - index;
      player.periods.last4.metrics.pointsPerGame.value = 50 + index;
      player.periods.season.metrics.targetShare.value = (index + 1) / 100;
      player.periods.season.metrics.rbCarryShare.value = (index + 1) / 25;
      return player;
    });
    await page.route(`**/data/${position.toLowerCase()}.json`, (route) =>
      route.fulfill({ json: data }),
    );
    await page.goto(`?position=${position.toLowerCase()}`);
    const scoring = page.getByTestId("scoring-chart");
    const role = page.getByTestId("role-chart");
    await expect(
      scoring.getByText(`${position}10 · 21.0`, { exact: true }),
    ).toBeVisible();
    await expect(
      role.getByText(
        `${position}10 · ${position === "WR" ? "15.0" : "60.0"}%`,
        { exact: true },
      ),
    ).toBeVisible();
    const before = await page.locator("[data-benchmark]").evaluateAll((lines) =>
      lines.map((line) => ({
        value: line.getAttribute("data-value"),
        y1: line.getAttribute("y1"),
        y2: line.getAttribute("y2"),
      })),
    );
    expect(before).toHaveLength(4);
    expect(before.every((line) => line.y1 === line.y2)).toBe(true);
    await page
      .getByRole("button", { name: "Last 4 games", exact: true })
      .click();
    const after = await page.locator("[data-benchmark]").evaluateAll((lines) =>
      lines.map((line) => ({
        value: line.getAttribute("data-value"),
        y1: line.getAttribute("y1"),
        y2: line.getAttribute("y2"),
      })),
    );
    expect(after).toEqual(before);
    await expect(page.locator(".period-highlight")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  });
}
