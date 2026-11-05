import { expect } from 'e2e';
import { test } from './fixtures.ts';

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive filtering and order. Scenario: Region filter narrows the list.
test('region filter narrows the list', async ({ app, agent, screen }) => {
  await app.open('/');
  await expect(screen.getByText('1–5 of 14')).toBeVisible();

  await agent.act('Filter the archive to the DE region');

  await expect(screen.getByText('1–2 of 2')).toBeVisible();
  await agent.assert('Every listed playlist has DE in its title');
});
