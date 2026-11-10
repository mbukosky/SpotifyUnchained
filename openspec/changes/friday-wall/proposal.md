# Proposal

## Why

The archive holds about 1,300 editions going back to July 2014, but the page shows them five accordions at a time: reaching 2014 takes 263 clicks on "next", no week can be jumped to or linked, and nothing on the page shows how much is preserved. The Friday Wall prototype (`client/src/prototypes/FridayWall.jsx` on branch `prototype/fun-ideas`) showed that one screen with a tile per week can replace pagination and make the archive's scale the first thing a visitor sees.

## What Changes

- **BREAKING** Replace the paginated list of playlist cards with the Friday Wall: one row per year, newest at the top, one tile per week. Weeks with no archived edition appear as empty slots.
- Replace the marketing hero and the "Archived Playlists" heading with a scale headline computed from the archive, for example "636 Fridays. 54,824 tracks. Since July 22, 2014." The "Every Friday, preserved." line and the Ko-fi link stay.
- Open an edition in a panel under the wall when its tile is activated. The panel shows a readable date title, the track count, every track with the existing preview and Spotify link, and the two existing save-to-Spotify buttons.
- Add previous and next edition buttons and a deep link: the open edition is in the URL as `?edition=<id>`, and loading that URL opens it.
- Add "Jump to a date", which opens the edition nearest a chosen date.
- Add "Lucky dip", which opens a random edition at a random track and starts its preview.
- With ALL selected, show one tile per week and let the panel switch between the regions archived that week.
- Derive every displayed edition date from the playlist title. This fixes two bugs in the current cards: dates one day early in time zones west of UTC, and dates about a week late on rows archived before 2026, whose stored date is the archive time.
- Add two read-only API endpoints: an index of every edition without its tracks, and one edition with its tracks. `GET /spotify` is unchanged.
- Remove the pagination controls, the "Per page" choice, the playlist card accordion and the decorative random waveform.

Not in this change: search, the Time Machine, the game and the cross-region view from the same prototype round.

No production data is written. Both new endpoints only read, and the change adds no migration, index or script.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `archive-browsing`: the wall, the edition panel, deep links, jump to a date and lucky dip replace the paginated list and the playlist cards. Region filtering, the page states, track listing and the motion rules change to match.
- `playlist-api`: adds the edition index and single-edition endpoints, with their own rate limit and error responses.
- `playlist-export`: the two save buttons move from the playlist card to the edition panel. What they send to Spotify does not change.

## Impact

- **Client:** `App.jsx`, `Hero.jsx`, `PlaylistList.jsx`, `PlaylistCard.jsx`, `Pagination.jsx`, `usePlaylists.js` and `index.css` are replaced or removed. `TrackItem.jsx`, `SavePlaylist.jsx` and `PlaylistDownload.jsx` are reused inside the panel.
- **Server:** new routes and a controller beside `server/controllers/playlist.js`. No schema change.
- **Tests:** new Vitest tests for the endpoints. `e2e/tests/archive-browsing.e2e.ts`, `playlist-export.e2e.ts`, `playlist-api.e2e.ts`, `helpers.ts` and `e2e/seed/seed.js` change, because most browser tests reach tracks through a card today.
- **Docs:** `CLAUDE.md` lists the new endpoints.
- **Dependencies:** none added. No new external domain, so the CSP is unchanged.
- **Visitors:** a saved region choice still applies. Old bookmarks carry no page number, so none break.
