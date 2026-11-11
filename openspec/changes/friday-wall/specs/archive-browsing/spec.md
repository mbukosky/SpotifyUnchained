# Spec Delta

## ADDED Requirements

### Requirement: Archive scale headline
The system SHALL show a headline above the wall in the form "N Fridays. T tracks. Since Month day, year.", where N is the number of weeks with a tile for the selected region, T is the total number of tracks in the editions those tiles stand for (every region's editions when ALL is selected), and the date is the earliest edition date among them. N and T SHALL use comma thousands separators. The line "Every Friday, preserved." SHALL appear with the headline.

#### Scenario: Headline for one region
- **WHEN** a visitor selects a region whose tiles cover 52 weeks holding 5,200 tracks, the earliest dated 21 February 2025
- **THEN** the headline reads "52 Fridays. 5,200 tracks. Since February 21, 2025."

#### Scenario: Headline follows the region
- **WHEN** a visitor switches from one region to another
- **THEN** the headline changes to the second region's counts and earliest date

### Requirement: Wall layout
The system SHALL show the archive as a wall with one row per calendar year that has an edition for the selected region, newest year at the top, each row labelled with its year. Each row SHALL hold one position per week of that year in date order, and month names SHALL label the columns. A week with an archived edition SHALL show a tile. A week with none SHALL show an empty slot that cannot be focused or activated.

#### Scenario: Rows run newest first
- **WHEN** a visitor views the wall for a region with editions from 2024 to 2026
- **THEN** the wall shows rows labelled 2026, 2025 and 2024, top to bottom

#### Scenario: Missing week leaves a gap
- **WHEN** a region has editions for 7 and 21 February 2026 and none for 14 February 2026
- **THEN** the 2026 row shows an empty slot between those two tiles
- **AND** the empty slot is skipped by the keyboard

### Requirement: Wall tiles
The system SHALL make each tile a button whose accessible name is the edition's date in the form "Weekday, Month day, year" followed by ", N tracks". When two editions of one region fall in the same week, the tile SHALL stand for the later one. Tiles SHALL be drawn in the selected region's accent color, and a tile for an edition with more tracks SHALL be drawn brighter than one with fewer.

#### Scenario: Tile is named for its edition
- **WHEN** a visitor views the US wall holding "New.Music.Friday.US.02.14.2026" with 30 tracks
- **THEN** the wall has a button named "Saturday, February 14, 2026, 30 tracks"

#### Scenario: Two editions in one week
- **WHEN** the US archive holds editions dated 7 July 2015 and 10 July 2015
- **THEN** that week shows one tile, named for 10 July 2015

### Requirement: Wall keyboard navigation
The system SHALL place exactly one tile in the Tab order at a time. While a tile has focus, the arrow keys SHALL move focus to the nearest tile in that direction, skipping empty slots, and Enter or Space SHALL open that tile's edition.

#### Scenario: Arrow keys move between tiles
- **WHEN** a tile has focus and a visitor presses the right arrow key
- **THEN** focus moves to the next tile in that year's row

#### Scenario: Tab leaves the wall
- **WHEN** a tile has focus and a visitor presses Tab
- **THEN** focus moves to the next control after the wall, not to another tile

### Requirement: Edition panel
The system SHALL open an edition in a panel below the wall when its tile is activated, and SHALL mark that tile as selected. The panel SHALL show the edition's date in the form "Weekday, Month day, year", its region code in that region's accent color, and its track count as "N tracks". A "Close edition" button, and the Escape key while focus is inside the panel, SHALL close the panel and clear the selection. Only one edition SHALL be open at a time.

#### Scenario: Tile opens its edition
- **WHEN** a visitor activates the tile for the US edition of 14 February 2026, which has 30 tracks
- **THEN** the panel shows "Saturday, February 14, 2026", the code "US" in the US accent color, and "30 tracks"
- **AND** that tile is marked selected

#### Scenario: Opening another edition replaces the first
- **WHEN** an edition is open and a visitor activates a different tile
- **THEN** the panel shows the second edition and only its tile is marked selected

#### Scenario: Panel closes
- **WHEN** a visitor activates "Close edition"
- **THEN** the panel is removed and no tile is marked selected

### Requirement: Edition panel loading and failure
The system SHALL show the text "Loading edition..." in the panel while an edition's tracks are being fetched, and SHALL show "Failed to load this edition. Please try again." in the panel when that fetch fails. The wall SHALL stay usable in both cases.

#### Scenario: Edition request fails
- **WHEN** a visitor activates a tile and the request for that edition returns an error
- **THEN** the panel shows "Failed to load this edition. Please try again."
- **AND** activating another tile opens that edition

### Requirement: Displayed edition dates
The system SHALL display every edition date as the calendar date reported for that edition by the playlist API, without shifting it for the visitor's time zone.

#### Scenario: Date does not shift west of UTC
- **WHEN** a visitor in the America/Los_Angeles time zone opens the edition dated 2026-02-14
- **THEN** the panel shows "Saturday, February 14, 2026"

### Requirement: Previous and next edition
The system SHALL show "Previous edition" and "Next edition" buttons in the panel that open the nearest earlier and nearest later edition of the same region by date, including an edition that has no tile of its own. The system SHALL disable "Previous edition" on the region's earliest edition and "Next edition" on its latest.

#### Scenario: Stepping back a week
- **WHEN** the US edition of 14 February 2026 is open and a visitor activates "Previous edition"
- **THEN** the panel shows the US edition of 7 February 2026

#### Scenario: Ends are disabled
- **WHEN** a region's latest edition is open
- **THEN** "Next edition" is disabled

### Requirement: Edition deep link
The system SHALL keep the open edition's id in the page URL as the `edition` query parameter, SHALL remove the parameter when the panel closes, and SHALL open that edition when the page is loaded with the parameter. An `edition` value that matches no edition SHALL be removed from the URL and SHALL NOT open a panel.

#### Scenario: URL follows the open edition
- **WHEN** a visitor opens an edition and then closes the panel
- **THEN** the URL holds `edition=<that edition's id>` while the panel is open
- **AND** the URL holds no `edition` parameter after it closes

#### Scenario: Loading a link opens the edition
- **WHEN** a visitor loads the page with `?edition=<id of the US edition of 14 February 2026>`
- **THEN** the panel shows that US edition and its tile is marked selected

#### Scenario: Unknown edition id
- **WHEN** a visitor loads the page with an `edition` value that matches no edition
- **THEN** the wall is shown with no panel open
- **AND** the `edition` parameter is removed from the URL

### Requirement: Deep link to another region
The system SHALL, when the page is loaded with an `edition` parameter whose edition belongs to a region other than the selected one and the selected region is not ALL, show the linked edition's region as selected for that visit without changing the saved region choice.

#### Scenario: Link overrides the saved region for the visit
- **WHEN** a visitor loads the page with `?edition=<id of the UK edition of 14 February 2026>` and a saved region of US
- **THEN** the UK button is active and the panel shows that UK edition
- **AND** the saved region choice is still US

### Requirement: Jump to a date
The system SHALL show a date field labelled "Jump to a date". When a visitor chooses a date, the system SHALL open the edition of the selected region whose date is nearest that date, choosing the later edition when two are equally near. While the field does not have focus it SHALL show the date of the open edition, however that edition was opened, and SHALL be empty when no edition is open.

#### Scenario: Nearest edition opens
- **WHEN** a visitor viewing a region with editions on 7 and 14 February 2026 chooses 12 February 2026
- **THEN** the panel shows the edition of 14 February 2026

#### Scenario: Field follows the open edition
- **WHEN** a visitor opens the edition of 14 February 2026 from its wall tile or a link
- **THEN** the "Jump to a date" field shows 14 February 2026
- **AND** stepping to the previous edition changes the field to that edition's date

### Requirement: Lucky dip
The system SHALL show a "Lucky dip" button that opens an edition chosen at random from the selected region (from every region when ALL is selected), opens one track chosen at random from it in the player bar, and scrolls that track's tile into view. When reduced motion is not requested, the system SHALL animate a highlight across several tiles before opening the edition. When reduced motion is requested, it SHALL open the edition without that animation.

#### Scenario: Lucky dip opens a track
- **WHEN** a visitor activates "Lucky dip"
- **THEN** the panel shows an edition of the selected region
- **AND** the player bar holds a Spotify embed for one track of that edition

### Requirement: All-regions wall
The system SHALL, when ALL is selected, show one tile per week that has an edition in any region, drawn in white, with the accessible name "Week of Weekday, Month day, year, N regions", where the date is the latest edition date in that week. Activating the tile SHALL open the panel with one button per region archived that week, in the order US, UK, CA, BR, MX, DE, AU, with the first selected. Selecting a region button SHALL show that region's edition for the week.

#### Scenario: Week tile counts its regions
- **WHEN** a visitor views the ALL wall and all seven regions have an edition dated 14 February 2026
- **THEN** the wall has a button named "Week of Saturday, February 14, 2026, 7 regions"

#### Scenario: Switching region inside the panel
- **WHEN** a visitor opens that week and selects the UK button in the panel
- **THEN** the panel shows the UK edition of 14 February 2026
- **AND** the URL's `edition` parameter is that UK edition's id

### Requirement: Wall on narrow screens
The system SHALL keep the page free of horizontal scrolling at any viewport width of 320 pixels or more. When the wall is wider than the viewport, it SHALL scroll horizontally inside its own container, the year labels SHALL stay visible while it scrolls, and the system SHALL scroll the wall so the selected tile, or the latest tile when none is selected, is in view.

#### Scenario: Wall scrolls inside its container
- **WHEN** a visitor views the wall at a viewport width of 390 pixels
- **THEN** the page does not scroll horizontally
- **AND** the wall scrolls horizontally with the year labels still visible
- **AND** the latest tile is in view

### Requirement: Track cover art
The system SHALL show each track's cover art on its tile, looked up in the visitor's browser from Spotify's public oEmbed endpoint (`https://open.spotify.com/oembed`), for tiles in or near the viewport only (tiles in the viewport first), at most six lookups at a time. When Spotify answers 429 the system SHALL stop sending lookups for at least 30 seconds (longer while 429s continue, up to five minutes), then resume one at a time, and tiles left unanswered SHALL get their cover once lookups resume. A cover found once MAY be kept in the browser's storage for up to 30 days, so the same track's tile shows it on a later visit without a lookup. Until a cover loads, and whenever the lookup or the image fails, the tile SHALL show the lead artist's initials on a color derived from the artist's name, with no error message.

#### Scenario: Cover loads
- **WHEN** a visitor opens an edition and Spotify returns a cover for a track
- **THEN** that track's tile shows the cover image

#### Scenario: Cover unavailable
- **WHEN** the cover lookup for a track fails
- **THEN** its tile shows the artist's initials on a colored background
- **AND** no error message is shown
- **AND** activating the tile still opens the track in the player bar

## MODIFIED Requirements

### Requirement: Archive filtering and order
The system SHALL show on the wall only editions for the selected region, except that ALL SHALL show every week that has an edition in any region. Selecting a region SHALL change the wall without reloading the page. When the open edition's region is not the newly selected region and the new selection is not ALL, the system SHALL close the panel.

#### Scenario: Region filter narrows the list
- **WHEN** a visitor selects DE
- **THEN** every tile on the wall stands for a DE edition

#### Scenario: ALL shows newest first across regions
- **WHEN** a visitor selects ALL
- **THEN** the wall shows one tile for every week that has an edition in any region, with the newest year's row at the top

#### Scenario: Changing region closes another region's edition
- **WHEN** a UK edition is open and a visitor selects DE
- **THEN** the panel closes
- **AND** the URL holds no `edition` parameter

### Requirement: Loading, empty and error states
The system SHALL show a spinner with the text "Loading playlists..." while the archive is being fetched. The system SHALL show the text "Failed to load playlists. Please try again." when the fetch fails. The system SHALL show "No playlists found" with the hint "Try selecting a different region filter." when the selected region has no editions. The system SHALL NOT show the wall, the headline, "Jump to a date" or "Lucky dip" during loading, error and empty states.

#### Scenario: Loading state while fetching
- **WHEN** a visitor loads the page
- **THEN** the spinner and "Loading playlists..." are shown until the request completes

#### Scenario: Request fails
- **WHEN** the archive request returns an error or cannot complete
- **THEN** the system shows "Failed to load playlists. Please try again."
- **AND** no wall is shown

#### Scenario: No playlists match
- **WHEN** the request succeeds and the selected region has no editions
- **THEN** the system shows "No playlists found" and "Try selecting a different region filter."
- **AND** no wall is shown

### Requirement: Track listing
The system SHALL show every track of the open edition as a cover tile in a grid, in playlist order. Each tile SHALL be a button with the accessible name "Play <track name> by <artist>". Hovering a tile with a mouse, or moving keyboard focus to it, SHALL show a label with the track's two-digit position number starting at 01, its name and its artist. The grid SHALL be a single Tab stop, and the arrow keys, Home and End SHALL move focus between tiles. The system SHALL NOT limit the number of tracks shown, and the panel SHALL show all tiles without being clipped.

#### Scenario: Long playlist shows every track
- **WHEN** a visitor opens an edition with 50 tracks
- **THEN** 50 cover tiles are shown in playlist order
- **AND** the last tile is fully visible when scrolled to, and the player bar does not cover it

#### Scenario: Focused tile names its track
- **WHEN** a visitor moves keyboard focus to the third tile of an edition
- **THEN** a label shows "03", the track's name and its artist

#### Scenario: Arrow keys move between tiles
- **WHEN** a tile has focus and a visitor presses the right arrow key
- **THEN** focus moves to the next tile
- **AND** pressing Tab moves focus out of the grid

### Requirement: Track preview
The system SHALL show a player bar with the track grid, which sits below the last row of tiles and scrolls with the grid. Activating a tile by click, Enter or Space SHALL open a Spotify player embed for that track in the player bar, mark the tile as playing, and attempt to start playback once the embed loads. While Spotify is answering cover lookups with 429, a newly opened track SHALL show a notice with a "Try now" button in place of the embed, replaced by the embed when lookups succeed again or the visitor activates "Try now"; an embed that is already open SHALL stay. When an embed loads but does not report ready within six seconds (Spotify refused it), the same notice SHALL cover it, with "Try now" loading it again, and cover lookups SHALL pause as for a 429. At most one embed SHALL exist at a time: activating another tile SHALL replace it. While a track is open the player bar SHALL show "Now playing", the track's position as "NN/total", its name and its artist, with a "Previous track" button, a "Next track" button, a link named "Open <track name> on Spotify" and a "Close player" button. "Previous track" SHALL be disabled on the first track and "Next track" on the last. The Spotify link SHALL open the track on Spotify in a new tab without closing the embed. "Close player" SHALL remove the embed and the playing mark.

#### Scenario: Preview opens and closes
- **WHEN** a visitor clicks the fifth tile of a 30-track edition
- **THEN** the player bar shows "05/30", that track's name and artist, and a Spotify embed for it
- **AND** the tile is marked as playing
- **AND** activating "Close player" removes the embed and the playing mark

#### Scenario: Spotify is limiting requests
- **WHEN** Spotify has answered a cover lookup with 429 and a visitor then activates a tile
- **THEN** the player bar shows the track's name and a notice that Spotify is limiting requests, with a "Try now" button, in place of the embed
- **AND** activating "Try now" loads the Spotify embed for that track

#### Scenario: Spotify refuses the embed
- **WHEN** a visitor activates a tile and Spotify answers the embed with an error page
- **THEN** within a few seconds a notice that the Spotify player did not load covers the embed, with a "Try now" button

#### Scenario: Another tile replaces the embed
- **WHEN** a track is open in the player bar and a visitor activates a different tile
- **THEN** the player bar shows the second track
- **AND** exactly one Spotify embed exists in the panel

#### Scenario: Next and previous track
- **WHEN** the first track is open in the player bar
- **THEN** "Previous track" is disabled
- **AND** activating "Next track" shows the second track in the player bar

#### Scenario: Spotify link does not toggle preview
- **WHEN** a visitor clicks the "Open ... on Spotify" link in the player bar
- **THEN** the track opens on Spotify in a new tab
- **AND** the embed stays open

#### Scenario: Spotify link from the keyboard
- **WHEN** a visitor focuses the "Open ... on Spotify" link in the player bar and presses Enter
- **THEN** the track opens on Spotify in a new tab
- **AND** the embed stays open

### Requirement: Reduced motion and pointer effects
The system SHALL respect the operating system's reduced-motion preference. When reduced motion is requested, the background SHALL be drawn once as a still image without animation, and CSS animations and transitions SHALL complete almost instantly. The background pointer parallax and the wall's tile ripple effect SHALL be active only on devices with a fine pointer and only when reduced motion is not requested.

#### Scenario: Reduced motion requested
- **WHEN** a visitor's system requests reduced motion
- **THEN** the background is displayed as a still frame
- **AND** CSS animations and transitions finish almost instantly

#### Scenario: Touch device without fine pointer
- **WHEN** a visitor uses a touch device without a fine pointer
- **THEN** moving the pointer does not parallax the background
- **AND** wall tiles do not ripple

## REMOVED Requirements

### Requirement: Pagination
**Reason**: The wall shows every edition on one screen, so there are no pages.
**Migration**: Reach any edition from its tile, "Jump to a date", or the previous and next buttons in the edition panel. `GET /spotify` still accepts `page` and `size` for other clients.

### Requirement: Playlist card content
**Reason**: Editions are tiles on the wall and open in the edition panel instead of cards.
**Migration**: The panel shows the edition's date, region and track count (see "Edition panel" and "Displayed edition dates"). The dotted title is no longer displayed.

### Requirement: Playlist card expansion
**Reason**: There are no cards to expand. A tile opens the edition panel.
**Migration**: See "Wall tiles", "Wall keyboard navigation" and "Edition panel". Tracks of an edition that is not open are not in the page at all, so they cannot be reached by the keyboard.
