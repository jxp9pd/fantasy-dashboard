import { test as base, expect } from '@playwright/test';

// Synthetic test players only. No production data or external service is needed.
export function positionFixture(position: 'WR' | 'RB' | 'TE') {
  const names = position === 'TE' ? ['Fixture Alpha Tight End', 'Fixture Beta Tight End', 'Fixture Gamma Tight End'] : position === 'WR' ? ['Fixture Alpha Receiver', 'Fixture Beta Receiver', 'Fixture Gamma Receiver'] : ['Fixture Alpha Runner', 'Fixture Beta Runner', 'Fixture Gamma Runner'];
  const players = names.map((name, i) => {
    const aggregate = (last4: boolean) => ({
      rank: last4 ? 3 - i : i + 1,
      games: last4 ? 4 : 5,
      coveredWeeks: last4 ? [2, 4, 5, 6] : [1, 2, 4, 5, 6],
      metrics: {
        pointsPerGame: { value: last4 ? 12 + i * 3 : 20 - i * 3 },
        xfpPerGame: { value: 15 - i, num: 75 - i * 5, den: 5 },
        targetsPerGame: { value: 8 - i, num: 40 - i * 5, den: 5 },
        targetShare: { value: .24 - i * .02, num: 24 - i * 2, den: 100 },
        routeParticipation: { value: null }, yardsPerRoute: { value: null },
        carriesPerGame: { value: 18 - i, num: 90 - i * 5, den: 5 },
        rbCarryShare: { value: .65 - i * .1, num: 65 - i * 10, den: 100 },
        inside5PerGame: { value: 1.2, num: 6, den: 5 },
        targetsPerRoute: { value: null }, endZoneTargetsPerGame: { value: 1.25, num: 5, den: 4 },
        firstDownsPerRoute: { value: null }, inside5Share: { value: 6 / 14, num: 6, den: 14 },
        yardsAfterContactPerCarry: { value: 2.6, num: 78, den: 30 },
      },
      coverage: { yardsAfterContactPerCarry: { covered: 3, total: 4 } },
    });
    return {
      playerId: `fixture-${position}-${i}`, name, team: ['BUF', 'BAL', 'SEA'][i],
      periods: { season: aggregate(false), last4: aggregate(true) },
      weeks: Array.from({ length: 18 }, (_, index) => {
        const week = index + 1;
        const status = week === 3 ? 'bye' : week === 7 ? 'inactive' : week === 8 ? 'not_on_team' : 'played';
        const available = week <= 6 && status === 'played';
        return { week, team: 'BUF', status, ...(week > 8 ? { upcoming: true } : {}), ...(week === 7 ? { injuryStatus: 'Out: hamstring' } : {}), values: {
          actual: available ? 14.2 + i + week : null, xfp: available ? 11.8 + week : null,
          targetShare: available ? .24 : null, rbCarryShare: available ? .65 : null, routeParticipation: null,
        } };
      }),
    };
  });
  return { meta: { season: 2026, position, scoring: 'Half-PPR · standard scoring, no return TDs', dataThroughWeek: 6, builtAt: new Date().toISOString(), partial: false, sources: [{ name: 'Fixture nflverse', updatedAt: new Date().toISOString(), throughWeek: 6 }] }, players };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]).*/, route => route.abort());
    await page.route('**/data/wr.json', route => route.fulfill({ json: positionFixture('WR') }));
    await page.route('**/data/rb.json', route => route.fulfill({ json: positionFixture('RB') }));
    await page.route('**/data/te.json', route => route.fulfill({ json: positionFixture('TE') }));
    await use(page);
  },
});
export { expect };
