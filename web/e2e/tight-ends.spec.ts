import { test, expect, positionFixture } from './fixtures';

test('Tight ends tab shows the top 25 receiving players and survives direct navigation', async ({ page }) => {
  const data = positionFixture('TE');
  data.players = Array.from({ length: 30 }, (_, index) => {
    const player = structuredClone(data.players[0]);
    player.playerId = `te-${index + 1}`;
    player.name = `Fixture Tight End ${index + 1}`;
    player.periods.season.rank = index + 1;
    player.periods.last4.rank = 30 - index;
    player.periods.season.metrics.pointsPerGame.value = 30 - index;
    player.periods.last4.metrics.pointsPerGame.value = index + 1;
    return player;
  });
  await page.route('**/data/te.json', route => route.fulfill({ json: data }));
  await page.goto('');
  await page.getByRole('link', { name: 'Tight ends', exact: true }).click();
  await expect(page).toHaveURL(/position=te/);
  await expect(page.getByRole('link', { name: 'Tight ends' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Tight ends', exact: true })).toBeVisible();
  const table = page.getByRole('region', { name: 'Player leaderboard' });
  await expect(table.getByRole('rowheader')).toHaveCount(25);
  await expect(table.getByRole('button')).toHaveText([
    'Points/G ↓', 'xFP/G ↕', 'Delta ↕', 'Targets/G ↕', 'Target share ↕', 'Route % ↕', 'Yards/route ↕',
  ]);
  await expect(table.getByText('Fixture Tight End 26', { exact: true })).toHaveCount(0);
  await expect(table.getByText('Fixture Alpha Receiver', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('role-chart').locator('.legend').getByText('Target share', { exact: true })).toBeVisible();
  await expect(page.getByTestId('comparison-endZoneTargetsPerGame')).toBeVisible();
  await expect(page.getByTestId('comparison-inside5Share')).toHaveCount(0);

  // Select a TE inside both periods' top 25, avoiding the existing selected-player pin.
  await table.getByText('Fixture Tight End 6', { exact: true }).click();
  await page.getByRole('button', { name: 'Last 4 games', exact: true }).click();
  await expect(table.getByRole('rowheader')).toHaveCount(25);
  await expect(table.getByText('Fixture Tight End 30', { exact: true })).toBeVisible();
  await expect(table.getByText('Fixture Tight End 1', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/position=te.*period=last4/);
  await expect(table.getByRole('rowheader')).toHaveCount(25);
  await expect(page.getByRole('button', { name: 'Last 4 games', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('player-detail')).toContainText('Fixture Tight End 30');
});
