import { test, expect } from './fixtures';

for (const position of ['wr', 'rb']) {
  test(`${position} touch selects a row and exposes chart values`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Touch interaction uses the mobile project.');
    await page.goto(`?position=${position}`);
    const name = position === 'wr' ? 'Fixture Beta Receiver' : 'Fixture Beta Runner';
    const row = page.getByRole('row').filter({ hasText: name });
    await row.tap();
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('player-detail')).toContainText(name);
    const scoring = page.getByTestId('scoring-chart');
    await scoring.getByRole('button', { name: /Week 1:/ }).first().tap();
    await expect(scoring.getByRole('status')).toContainText(/Week 1.*16\.2.*12\.8/);
    const role = page.getByTestId('role-chart');
    await role.getByRole('button', { name: /Week 1:/ }).first().tap();
    await expect(role.getByRole('status')).toContainText(position === 'wr' ? '24.0% target share' : '65.0% share of rb carries');
  });
}
