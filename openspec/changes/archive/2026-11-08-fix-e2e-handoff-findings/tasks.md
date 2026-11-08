# Tasks

## 1. App fixes

- [x] 1.1 Re-measure the expanded card when its content resizes (`PlaylistCard.jsx`)
- [x] 1.2 Reset to page 1 when the region changes (`PlaylistList.jsx`)
- [x] 1.3 Toggle the card and track preview only for keys on the header or row itself (`PlaylistCard.jsx`, `TrackItem.jsx`)
- [x] 1.4 Make a collapsed card's tracks `inert` (`PlaylistCard.jsx`)

## 2. E2E tests

- [x] 2.1 Region change resets the page (`archive-browsing.e2e.ts`)
- [x] 2.2 Collapsed tracks are skipped by the keyboard (`archive-browsing.e2e.ts`)
- [x] 2.3 Spotify link from the keyboard (`archive-browsing.e2e.ts`)
- [x] 2.4 Header save from the keyboard (`playlist-export.e2e.ts`)
- [x] 2.5 Update the Unknown route test comment (`service-runtime.e2e.ts`)
- [x] 2.6 Full e2e run passes, including the previously red clipped-alert test
