# Spec Delta

## MODIFIED Requirements

### Requirement: Track cover art
The system SHALL show each track's cover art on its tile, using the cover URL the edition carries for that track. The system SHALL NOT request cover information from Spotify in the visitor's browser: opening an edition SHALL send no request to `https://open.spotify.com/oembed`, and the only requests to Spotify for covers SHALL be the images themselves. The system SHALL NOT keep track ids or cover URLs in the browser's storage. Until a cover image loads, and whenever a track has no cover or its image fails, the tile SHALL show the lead artist's initials on a color derived from the artist's name, with no error message.

#### Scenario: Cover loads
- **WHEN** a visitor opens an edition whose tracks carry cover URLs
- **THEN** each of those tracks' tiles shows its cover image

#### Scenario: No lookups from the browser
- **WHEN** a visitor opens an edition of 100 tracks and scrolls through all of it
- **THEN** the browser sends no request to `https://open.spotify.com/oembed`

#### Scenario: Cover unavailable
- **WHEN** a track of the open edition has no cover, or its cover image fails to load
- **THEN** its tile shows the artist's initials on a colored background
- **AND** no error message is shown
- **AND** activating the tile still opens the track in the player bar

### Requirement: Track preview
The system SHALL show a player bar with the track grid, which sits below the last row of tiles and scrolls with the grid. Activating a tile by click, Enter or Space SHALL open a Spotify player embed for that track in the player bar, mark the tile as playing, and attempt to start playback once the embed loads. When an embed loads but does not report ready within six seconds (Spotify refused it), a notice with a "Try now" button SHALL cover it, with "Try now" loading it again. A track opened within 30 seconds of a refused embed SHALL show the notice with "Try now" in place of the embed, replaced by the embed when the 30 seconds end or the visitor activates "Try now"; an embed that is already working SHALL stay. At most one embed SHALL exist at a time: activating another tile SHALL replace it. While a track is open the player bar SHALL show "Now playing", the track's position as "NN/total", its name and its artist, with a "Previous track" button, a "Next track" button, a link named "Open <track name> on Spotify" and a "Close player" button. "Previous track" SHALL be disabled on the first track and "Next track" on the last. The Spotify link SHALL open the track on Spotify in a new tab without closing the embed. "Close player" SHALL remove the embed and the playing mark.

#### Scenario: Preview opens and closes
- **WHEN** a visitor clicks the fifth tile of a 30-track edition
- **THEN** the player bar shows "05/30", that track's name and artist, and a Spotify embed for it
- **AND** the tile is marked as playing
- **AND** activating "Close player" removes the embed and the playing mark

#### Scenario: Spotify refuses the embed
- **WHEN** a visitor activates a tile and Spotify answers the embed with an error page
- **THEN** within a few seconds a notice that the Spotify player did not load covers the embed, with a "Try now" button

#### Scenario: Spotify is limiting requests
- **WHEN** Spotify has just refused an embed and a visitor activates another tile
- **THEN** the player bar shows the track's name and a notice that Spotify is limiting requests, with a "Try now" button, in place of the embed
- **AND** activating "Try now" loads the Spotify embed for that track

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
