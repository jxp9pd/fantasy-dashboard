import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

for (const position of ['wr', 'rb']) {
  for (const period of ['season', 'last4']) {
    test(`${position} ${period} has no serious or critical accessibility violations`, async ({ page }) => {
      await page.goto(`?position=${position}&period=${period}`);
      await expect(page.getByTestId('player-detail')).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const violations = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
      const summary = violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) }));
      expect(summary).toEqual([]);
    });
  }
}
