---
paths:
  - "e2e/**"
---

# E2E tests

The tool's docs are offline in `e2e/node_modules/e2e/docs`. Each test is one scenario from `openspec/specs/`, named in a comment above it. `playlist-sync` and `archive-backfill` belong in Vitest.

## Rules

- **Real data:** tests use only `e2e/seed/seed.js`, fake Spotify credentials and port 27018. Dev Mongo on 27017, its `su_prod` restore, `.env`, `.env.prod` and `backup-*/` stay out of it, because production data is irreplaceable.
- **Spotify:** the server's token endpoints call Spotify from Node, where `browser.route` can't reach. Browser tests mock `/api/spotify/*` (`mockTokenEndpoints`), and direct HTTP tests send only requests the server rejects before contacting Spotify.
- **External hosts:** import `test` from `tests/fixtures.ts`, whose `appHostOnly` keeps fake visits out of production GA4. Mock hosts with `browser.route`; a test's own route runs first. Verify GA4 with a stubbed tag, never a real request.
- **Telemetry:** set `E2E_TELEMETRY_DISABLED=1` on every `e2e` command, and keep the opt-out in `~/.config/e2e/telemetry.json`.
- **Spec disagreements:** when the app disagrees with a spec, leave the test red and report it. App code and specs change only after review.

## Agent steps

Keep `claudeCode({ model: 'haiku' })`, using `agent.act` and `agent.assert` only: this setup can't run `agent.waitFor` or `agent.extract`.

Aim for about half of the browser tests driven by the agent, using it where it fits:

- **`agent.act` plus `expect`:** for a user-goal action in a browser test. Follow it with a locator or `expect(browser)` assertion, because plain values and `expect.poll` leave it unconfirmed, and it then calls the model on every run. A confirmed act replays from `.e2e/cache` for free. Word it as one plain action: extra checking by the agent gets recorded and can go stale on replay, which calls the model again. Check `step.cache.write` in `.e2e/report.json` when a warm run's tokens rise.
- **Scripted actions:** for keyboard and pointer input, states that revert on a timer (a cold act can outlast them), steps with no state change in the page's accessibility tree, such as an icon swap, which never cache and call the model every run, and `<select>` controls below the seed's long playlists, which fall past the agent's truncated snapshot.
- **`agent.assert`:** only for judgement a locator can't make from the page's text. It runs live every run at about 30k tokens, and it reads text only: this executor rejects `vision`. When adding one, confirm a false version fails.

Use `--no-cache` only when debugging. The cache isn't committed, so a fresh checkout records every act once.

## Gotchas

- `seed.js` runs in the `mongo:5.0` legacy shell, so it stays plain ES5. Its header lists the data tests depend on, and tests hardcode its counts.
- `/spotify` and `/rss` share 100 requests per 15 minutes per server process, and browser tests spend that budget. Non-browser tests send their own address with `asClient`. Report 429s rather than changing the limits.
- The date scenario needs a known time zone, so `e2e.config.ts` pins UTC.
- Browser requests to anything except 127.0.0.1:3100 are blocked, including Google Fonts, so don't assert on fonts or on layout that depends on them.
- `app.command` gets only the env vars listed in `e2e.config.ts`.
- `toBeVisible` ignores overflow clipping, so measure against the clipping box when clipping matters.
