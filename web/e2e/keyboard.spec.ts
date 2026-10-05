import { test, expect } from './fixtures';

test('keyboard sorts both directions and selects a player', async ({ page }) => {
  await page.goto('');
  const header = page.getByRole('button', { name: 'Points/G', exact: true });
  for (let i = 0; i < 30 && !(await header.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(header).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('columnheader').filter({ has: header })).toHaveAttribute('aria-sort', 'ascending');
  await page.keyboard.press('Space');
  await expect(page.getByRole('columnheader').filter({ has: header })).toHaveAttribute('aria-sort', 'descending');
  const row = page.getByRole('row').filter({ hasText: 'Fixture Beta Receiver' });
  for (let i = 0; i < 30 && !(await row.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(row).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('player-detail')).toContainText('Fixture Beta Receiver');
  await header.focus(); await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Last 4 games', exact: true }).click();
  await expect(page).toHaveURL(/period=last4/);
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('player-detail')).toContainText('Weeks 2, 4, 5, 6');
  await page.getByRole('link', { name: 'Running backs', exact: true }).click();
  await expect(page).toHaveURL(/period=last4/);
});
