import { test as base } from '@e2e-dev/web';

export const test = base.extend<{ appHostOnly: void }>({
  // Runs for every test. The page loads the live GA4 tag, so without this each
  // run would report fake visits to production analytics.
  appHostOnly: async ({ browser }, use) => {
    await browser.route(/^(?!http:\/\/127\.0\.0\.1:3100\/)/, (route) => route.abort());
    await use();
  },
});
