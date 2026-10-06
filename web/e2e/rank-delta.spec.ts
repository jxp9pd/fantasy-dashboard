import { test, expect } from './fixtures';

for (const position of ['wr', 'rb', 'te']) {
  test(`${position} rank follows the displayed order and Delta follows the selected period`, async ({ page }) => {
    await page.goto(`?position=${position}`);
    const table = page.getByRole('region', { name: 'Player leaderboard' });
    const rows = table.getByRole('row').filter({ has: page.getByRole('rowheader') });
    const ranks = table.locator('tbody .rank-column');
    await expect(table.getByRole('columnheader', { name: 'Rank', exact: true })).toBeVisible();
    await expect(ranks).toHaveText(['1', '2', '3']);
    await expect(rows.first().getByRole('cell').nth(3)).toHaveText('5.0');

    const delta = table.getByRole('button', { name: 'Delta', exact: true });
    await delta.click();
    await delta.click();
    await expect(rows.first().getByRole('rowheader')).toContainText('Gamma');
    await expect(rows.first().getByRole('cell').nth(3)).toHaveText('1.0');
    await expect(ranks).toHaveText(['1', '2', '3']);

    await page.getByRole('button', { name: 'Last 4 games', exact: true }).click();
    await expect(rows.first().getByRole('rowheader')).toContainText('Alpha');
    await expect(rows.first().getByRole('cell').nth(3)).toHaveText('-3.0');
    await page.getByRole('searchbox', { name: 'Search players' }).fill('Gamma');
    await expect(ranks).toHaveText(['1']);
    await expect(rows.first().getByRole('cell').nth(3)).toHaveText('5.0');
  });
}
