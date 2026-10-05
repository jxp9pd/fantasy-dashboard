import { test, expect } from './fixtures';

for (const position of ['wr', 'rb']) {
  test(`${position} charts reflow without page overflow`, async ({ page }, testInfo) => {
    await page.goto(`?position=${position}`);
    const scoring = page.getByTestId('scoring-chart');
    const role = page.getByTestId('role-chart');
    await expect(scoring).toBeVisible();
    await expect(role).toBeVisible();
    const first = await scoring.boundingBox();
    const second = await role.boundingBox();
    expect(first).not.toBeNull(); expect(second).not.toBeNull();
    if (testInfo.project.name === 'desktop') {
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(5);
      expect(second!.x).toBeGreaterThan(first!.x + first!.width - 1);
    } else {
      expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
      expect(Math.abs(first!.x - second!.x)).toBeLessThan(5);
    }
    const dimensions = await page.evaluate(viewportWidth => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, overflow: Array.from(document.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > viewportWidth + 1 && !el.closest('.table-scroll')).map(el => ({ tag: el.tagName, class: el.getAttribute('class'), right: el.getBoundingClientRect().right })).slice(0, 20) }), page.viewportSize()!.width);
    expect(dimensions.scroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(dimensions.inner).toBeLessThanOrEqual(page.viewportSize()!.width);
    const table = page.getByRole('region', { name: 'Player leaderboard' });
    expect(await table.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(testInfo.project.name === 'mobile');
    if (position === 'wr') await page.screenshot({ path: `/tmp/fantasy-dashboard-${testInfo.project.name}.png`, fullPage: true });
  });
}
