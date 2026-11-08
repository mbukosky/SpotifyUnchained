# Tasks

## 1. Skip the write on an empty fetch

- [x] 1.1 In `syncPlaylist` (`server/lib/sync.js`), right after `fetchPlaylistTracks`, return early with `console.warn(\`Skipping ${title}: Spotify returned no tracks\`)` when `tracks.length === 0`. Verify that the three existing repro tests under "when Spotify returns no storable tracks" in `server/lib/sync.test.js` pass: empty `items`, all-null `track`, and at least one track
- [x] 1.2 Export `sync` from `server/lib/sync.js` and add a Vitest test to `server/lib/sync.test.js` that mocks the token response, returns an empty page for the first region and one track for every other region, and asserts that `Playlist.findOneAndUpdate` is called once for each of the other six regions. Verify the new test passes

## 2. Verification

- [x] 2.1 Run `bun run test` and verify the whole suite passes
- [x] 2.2 Run `openspec validate --all --strict` and verify it passes

## Workflow follow-up

- Archive the change after review, which merges the delta into `openspec/specs/playlist-sync/spec.md`.
- Close issue #169 from the PR.
