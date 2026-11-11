# Design

## Context

See `proposal.md` for the motivation. The facts that shape the approach:

- The home page fetches `GET /spotify?page&size&sort&region`, which returns whole playlists with their tracks. Five playlists is already about 500 tracks, so the wall cannot be drawn from this endpoint: the full archive is about 134,000 track rows.
- `published_date` cannot place an edition on the wall. Rows synced before 2026 store the archive time, about six days after the edition. Rows synced since store midnight UTC, which the cards show a day early west of UTC. The title carries the real edition date in every row but one ("2014-12-30 New Music Tuesday").
- The local archive holds 46 Tuesday editions (2014–15), one week with both a Tuesday and a Friday edition (July 2015), and one week stored twice (US 02.06.2026, once with and once without the region in its title).
- The prototype on `prototype/fun-ideas` is the visual reference. It was written without tests, with ALL treated as US, and against throwaway `/api/proto` endpoints, so it is rewritten here and not copied.
- `TrackItem`, `SavePlaylist` and `PlaylistDownload` take a `playlist` or `track` prop and do not depend on the card, so the panel can reuse them unchanged.

## Goals / Non-Goals

**Goals:**

- Draw the whole archive from one small request, and switch region without another.
- Keep every existing track and save behavior working inside the panel.
- Keep `GET /spotify` and the RSS feed untouched.

**Non-Goals:**

- Fixing `published_date` in the database. Production data is irreplaceable and the title already gives the right date.
- Merging or deleting the duplicate US 02.06.2026 row.
- Restoring the open edition after the Spotify sign-in redirect. Sign-in returns to the site root, as it does today.
- Server-side rendering or a route per edition.

## Decisions

### 1. Two new read-only endpoints under `/spotify/editions`

`GET /spotify/editions` returns every edition as `{ id, region, date, trackCount }`, plus `tuesday: true` on Tuesday editions. `GET /spotify/editions/:id` returns one edition with its tracks as parallel columns. They live under `/spotify` because the Vite proxy, the CORS scope and the e2e host rules already cover that prefix.

The index takes no `region` parameter. The client fetches it once and filters in memory, so changing region costs no request. About 1,300 rows at roughly 110 bytes each is 150 KB before compression and about 15 KB after.

*Alternatives considered:* raising the `size` cap on `GET /spotify` (megabytes of tracks nobody opens), and a `fields=` parameter on it (changes a specified endpoint that the RSS feed and outside clients share).

### 2. The edition date is computed on the server, from the title

A small pure function in `server/lib/` returns `YYYY-MM-DD` from `MM.DD.YYYY` or `YYYY-MM-DD` in the title and falls back to the UTC date of `published_date`. The index query projects `title`, `region`, `published_date` and `{ $size: '$tracks' }`, then the controller adds the date, drops duplicates per region and date (most tracks, then latest `published_date`) and sorts.

The client treats `date` as a plain calendar date and builds `new Date(y, m - 1, d)` for formatting, so no time zone can shift it.

*Alternative considered:* computing dates in the client from titles. Rejected because the detail endpoint, the tests and any later consumer would each need the same parsing.

### 3. A short browser cache, and a pre-compressed in-memory server cache

The index query reads about 1,300 small projections and took under 100 ms in the prototype. It gets `Cache-Control: public, max-age=300`. A single edition never changes after its week, so it gets `max-age=3600`. Responses (for `GET /spotify`, only pages up to 128 kB, so a visitor cannot make the server Brotli-encode and hold megabyte pages) are also held pre-compressed in an in-process cache with a strong `ETag`, answered with 304 on a matching `If-None-Match`, and the cache is cleared when the Friday sync writes.

### 4. A separate rate limit for the edition endpoints

`GET /spotify` and `GET /rss` share 100 requests per 15 minutes. Each tile a visitor opens is one edition request, and lucky dip is one more, so a curious visitor could spend that budget in a few minutes and then break the RSS feed for their address. The edition endpoints get their own limiter at 900 per 15 minutes, which leaves room for the client prefetching the neighbouring editions. The client also keeps opened editions in a `Map` for the life of the page, so reopening costs nothing.

### 5. Wall geometry: rows are calendar years, columns are Monday-to-Sunday weeks

Each edition is placed in the row of its calendar year, in the column of the Monday-to-Sunday week it falls in, counted from the week that holds 1 January. A Tuesday edition lands in the same column as that week's Friday, and the year label on a row always matches the dates in it.

ISO week numbers were the first choice and were dropped during the build: an edition in the last days of December can belong to ISO week 1 of the next year, and pulling it back into its calendar year's row could land two tiles in one column.

When two editions of a region share a week, the tile stands for the later one. The earlier one stays reachable through "Previous edition", a deep link and "Jump to a date", because those work on the region's full date-ordered list and not on tiles.

Tile brightness maps track count onto four steps between the region's 5th and 95th percentile. A linear scale from minimum to maximum made every US tile since 2018 the same gold in the prototype, because a handful of 30-track weeks from 2014 stretch the range.

### 6. ALL shows weeks, not editions

With ALL selected, editions are grouped by ISO week across regions and each group is one white tile. Brightness encodes how many regions that week has, which makes the March 2024 expansion visible on the wall. The panel shows a row of region buttons for the week. "Previous edition" and "Next edition" stay within the region shown in the panel.

*Alternative considered:* treating ALL as US with a note, as the prototype did. Rejected because the ALL button would then hide six regions with no way to see them without leaving ALL.

### 7. Component structure

```
App
└─ Archive            fetches the index, owns region view and open edition, syncs ?edition=
   ├─ ScaleHeadline   counts from the filtered index
   ├─ WallControls    Lucky dip, Jump to a date, Ko-fi link
   ├─ Wall            rows, tiles, roving tabindex, ripple, lucky-dip highlight
   └─ EditionPanel    header (title, save, prev/next, close, region buttons)
      ├─ CoverGrid    one cover tile per track, roving tabindex, hover label
      └─ PlayerBar    now playing, prev/next track, Spotify link, close, embed, SavePlaylist
```

Pure logic goes in `client/src/lib/wall.js` (ISO week, grouping, percentiles, nearest edition, headline numbers) so Vitest can cover it. The root Vitest config already includes `client/src/**/*.test.js`.

The panel is rendered inline below the wall, not as a drawer or modal. It needs no focus trap, the wall stays visible above it on desktop, and it scrolls naturally on mobile. Opening an edition scrolls the panel's heading into view and moves focus to it.

`RegionProvider` gains a view-only override: a deep link can show another region as selected without writing `selectedRegion`. Clicking any region button clears the override and saves as today.

### 8. URL state uses `history.replaceState`

Opening, switching and closing editions replace the current history entry. Stepping through twenty weeks should not leave twenty Back presses between the visitor and the page they came from.

The OAuth callback lands on the site root with `code` and `state`. The archive reads only `edition` and leaves other parameters alone.

### 9. Removed code

`Hero.jsx`, `PlaylistList.jsx`, `PlaylistCard.jsx`, `Pagination.jsx`, `usePlaylists.js` and their CSS are deleted, along with the unused `apiGet` helper if nothing else imports it. The `.pcard-dl` button styles move to the panel header because `PlaylistDownload` still uses them.

### 10. Tracks are a cover mosaic with one player bar

The first build reused `TrackItem`, one 60-pixel row per track with the embed opening under the row. A 149-track edition was about 9,000 pixels tall and the save button sat at the very end. Three compact variants were prototyped (colored initial tiles, album covers, four-column text). The cover mosaic was chosen: 149 tracks take about 680 pixels on a desktop.

- Tiles are 60 pixels square (44 on narrow screens) in a wrapping grid. Each is a button named "Play <name> by <artist>". The grid uses the same roving tabindex as the wall.
- A label with position, name and artist follows mouse hover and keyboard focus. Touch has no hover, so on touch the name appears in the player bar once the tile is tapped.
- One player bar sits under the grid with `position: sticky; bottom: 0`. It holds the single embed (the compact 80-pixel Spotify player), previous and next track, the Spotify link, close, and `SavePlaylist`. The grid's scroll container gets bottom padding or the bar sits after the grid in flow, so the bar never covers the last row once the visitor reaches the end.
- Activating the playing tile again leaves it playing. Closing is the bar's "Close player" button.
- `TrackItem.jsx` and its CSS are deleted.

### 11. Covers come from Spotify oEmbed, in the browser

The database stores no image addresses, and the Web API needs a token. `https://open.spotify.com/oembed?url=https://open.spotify.com/track/<id>` returns a `thumbnail_url` on Spotify's image CDN with no credentials and `Access-Control-Allow-Origin: *`. The client requests covers for tiles in the viewport first (top to bottom), then for tiles within about 400 pixels of it, six at a time (a 429 stops all lookups for 30 seconds, doubling up to five minutes while 429s continue, then they resume one at a time; a dropped connection pauses them the same way from 5 seconds; the player embed shares Spotify's limit, so while limited a newly opened track shows a notice with "Try now" instead of the embed), and drops queued lookups for tiles that are gone when the edition changes. Results live in a `Map` for the life of the page, and found ones also in `localStorage` (`su:covers:v1`, at most 2,000 tracks, 30 days each, Spotify image-CDN URLs only, every access in `try`), so a reopened edition paints without lookups. Pressing or resting on a wall tile preconnects to oEmbed and the two image CDN hosts.

oEmbed hands out the 300 px album image (`ab67616d00001e02<id>`); the CDN also serves the same image at 64 px (`ab67616d00004851<id>`) and 640 px. Where a tile is at most about 74 device pixels wide (a ~61 px tile on a 1x screen), the tile shows the 64 px variant (2–3 kB instead of ~27 kB) and swaps in the 300 px one, decoded first, when it is enlarged by hover or keyboard focus, or if the small one fails. Thumbnails in any other form are used as returned. Hedging slow lookups with a second request was measured and does not help: a slow track is slow for both requests.

Every tile starts as a generated fallback (initials on a hue hashed from the lead artist's name, offset from the region accent) and the image fades in over it, so a failed or slow lookup costs nothing but the picture.

The CSP `connect-src` list gains `https://open.spotify.com`. `img-src` gains `https://*.spotifycdn.com`: the performance baseline run found that oEmbed returns most thumbnails on `image-cdn-ak.spotifycdn.com` and `image-cdn-fa.spotifycdn.com`, not on `i.scdn.co`, and a production build blocked them. The wildcard covers further CDN shards. The Vite dev server sends no CSP and the e2e cover test stubs the image, which is how the first build missed it. `frame-src` already allows the embed.

*Alternatives considered:* storing cover addresses at sync time (needs a schema change and a backfill write over irreplaceable production data, for 134,000 rows), and a server proxy with a cache (moves an unauthenticated third-party call onto our rate budget and address).

## Risks / Trade-offs

- [Most e2e browser tests reach tracks by expanding a card] → Rewrite `helpers.ts` first with an "open edition" helper that loads `/?edition=<id>`, so track, preview and save tests change one line each. The seed gains fixed `_id` values for the editions tests open.
- [The seed's 52 AU weeks span two calendar years and its other regions have two weeks, so the wall looks sparse in tests] → That is enough for every scenario. Add only the rows a scenario needs: a same-week pair, a duplicate, and an undated title.
- [A wall of about 640 buttons could be slow to render or to tab through] → Roving tabindex keeps one tile in the Tab order. Tiles are plain buttons with no per-tile listeners: one delegated pointer handler on the wall drives the ripple, as the prototype did.
- [The headline says "Fridays" while 46 editions fell on a Tuesday] → Kept, because the count is of weeks and the product is New Music Friday. The Tuesday tiles carry their true weekday in their names.
- [Visitors who liked seeing the newest tracks at once now need a click] → The latest tile pulses and is the wall's first Tab stop. If this proves a problem, opening the latest edition by default is a small follow-up.
- [The archive Purpose text in `openspec/specs/archive-browsing/spec.md` and `playlist-export/spec.md` still mentions cards and pagination after archive] → Listed as a workflow follow-up, because a delta cannot change a Purpose.
- [Requirement names in `playlist-export` still say "expanded-card"] → Left alone to keep the delta small. They now refer to the save button at the end of the panel's track list.

- [The oEmbed endpoint publishes no rate limit and could change or throttle] → Lookups are lazy, capped at six in flight and cached per page. On any failure the tile keeps its fallback and still plays. A failed lookup may be tried again after a minute, on hover or when the edition is reopened: heavy testing drew a few minutes of 429 responses from Spotify.
- [Cover lookups tell Spotify which tracks a visitor's screen showed] → The embed already does this for every played track, and the request carries no cookie of ours. Accepted.
- [On touch a visitor cannot read a track's name without playing it] → Accepted for now: covers are recognizable and the bar names the track on tap. A text-list toggle is a possible follow-up.
- [E2E runs block every host but the app] → Cover tests assert the fallback tile, which is what a blocked lookup produces. The loaded-cover scenario is checked by hand against the dev server.

## Migration Plan

One deploy, no data step. Rollback is reverting the merge: the old page needs only `GET /spotify`, which this change does not touch.
