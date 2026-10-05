import AxeBuilder from "@axe-core/playwright";
import { test, expect, positionFixture } from "./fixtures";

for (const position of ["WR", "RB"] as const) {
  test(`${position} filters discover outside-top players, combine, clear and work by keyboard and touch`, async ({
    page,
  }, testInfo) => {
    const data = positionFixture(position);
    const outside = structuredClone(data.players[2]);
    outside.playerId = "outside";
    outside.name = "Fixture Outside Player";
    outside.team = "BAL";
    outside.periods.season.rank = 151;
    outside.periods.last4.rank = 151;
    data.players.push(outside);
    for (let i = 0; i < 20; i++) {
      const filler = structuredClone(data.players[2]);
      filler.playerId = `filler-${i}`;
      filler.name = `Unlisted filler ${i}`;
      filler.periods.season.rank = 200 + i;
      filler.periods.last4.rank = 200 + i;
      filler.periods.season.metrics.pointsPerGame.value = 1 + i / 10;
      data.players.push(filler);
    }
    await page.route(`**/data/${position.toLowerCase()}.json`, (route) =>
      route.fulfill({ json: data }),
    );
    await page.goto(`?position=${position.toLowerCase()}`);
    const search = page.getByRole("searchbox", { name: "Search players" });
    const team = page.getByRole("combobox", { name: "Team" });
    const table = page.getByRole("region", { name: "Player leaderboard" });
    const rows = table.getByRole("rowheader");
    await expect(rows).toHaveCount(3);
    const benchmarks = await page
      .locator("[data-benchmark]")
      .evaluateAll((lines) => lines.map((l) => l.getAttribute("data-value")));
    await search.focus();
    await search.pressSequentially("OUTSIDE");
    await team.selectOption("BAL");
    await expect(rows).toHaveCount(1);
    await expect(page.getByText("1 result", { exact: true })).toBeVisible();
    const row = table
      .getByRole("row")
      .filter({ hasText: "Fixture Outside Player" });
    if (testInfo.project.name === "mobile") await row.tap();
    else {
      await row.focus();
      await page.keyboard.press("Enter");
    }
    await expect(
      page
        .getByTestId("player-detail")
        .getByRole("heading", { name: "Fixture Outside Player BAL" }),
    ).toBeVisible();
    await expect(row).toHaveAttribute("aria-selected", "true");
    await search.fill("Alpha");
    await expect(
      page.getByText("No players match these filters."),
    ).toBeVisible();
    await expect(rows).toHaveCount(0);
    await expect(
      page
        .getByTestId("player-detail")
        .getByRole("heading", { name: "Fixture Outside Player BAL" }),
    ).toBeVisible();
    const clear = page.getByRole("button", { name: "Clear filters" });
    if (testInfo.project.name === "mobile") await clear.tap();
    else {
      await clear.focus();
      await page.keyboard.press("Enter");
    }
    await expect(search).toHaveValue("");
    await expect(team).toHaveValue("");
    await expect(rows).toHaveCount(4);
    await expect(
      page.getByText(`Outside top ${position === "WR" ? 100 : 50} · pinned`),
    ).toBeVisible();
    await search.fill("Beta");
    await team.selectOption("BAL");
    await page
      .getByRole("button", { name: "Last 4 games", exact: true })
      .click();
    await expect(rows).toHaveCount(1);
    await expect(page.locator("[data-benchmark]")).toHaveCount(4);
    expect(
      await page
        .locator("[data-benchmark]")
        .evaluateAll((lines) => lines.map((l) => l.getAttribute("data-value"))),
    ).toEqual(benchmarks);
    await page
      .getByRole("link", {
        name: position === "WR" ? "Running backs" : "Wide receivers",
      })
      .click();
    await expect(search).toHaveValue("Beta");
    await expect(team).toHaveValue("BAL");
    await expect(rows).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  });
}
