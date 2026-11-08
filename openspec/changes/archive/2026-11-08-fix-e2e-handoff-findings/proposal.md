# Proposal

## Why

The e2e suite found five problems (`.claude/plans/handoff`). One breaks an existing spec (the save error alert is clipped). The other four are bugs or wording problems the specs don't cover: changing region can strand the visitor on an empty page, Enter or Space on a control inside a card header toggles the card instead of activating the control, collapsed cards' tracks are still in the tab order, and the "Unknown route" scenario contradicts the production SPA fallback.

## What Changes

- The expanded card re-measures its height when its content changes, so the save error alert is fully visible. No spec change: the existing scenario already requires it.
- Changing the region returns the list to page 1.
- Enter or Space on the header save button saves instead of toggling the card. Enter on a track's Spotify link opens the link instead of toggling the preview.
- A collapsed card's tracks are not reachable with the keyboard or exposed to assistive technology.
- The "Unknown route" scenario names a request the SPA fallback doesn't serve.

## Capabilities

### New Capabilities

### Modified Capabilities
- `archive-browsing`: region change resets pagination; header keys only toggle when the header itself is focused; collapsed tracks are out of the tab order; the Spotify link works from the keyboard.
- `playlist-export`: the header save button works from the keyboard without toggling the card.
- `service-runtime`: the "Unknown route" scenario uses a POST, which the SPA fallback never serves.

## Impact

- `client/src/components/PlaylistCard.jsx`, `PlaylistList.jsx`, `TrackItem.jsx`.
- `e2e/tests/archive-browsing.e2e.ts`, `playlist-export.e2e.ts`, `service-runtime.e2e.ts`.
- No server, API or data changes.
