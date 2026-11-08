## MODIFIED Requirements

### Requirement: Pagination
The system SHALL show 5 playlists per page by default, and SHALL offer a "Per page" choice of 5, 10, 15 or 20. Changing the page size or the region SHALL return the list to page 1. The system SHALL show the range of playlists on the current page in the form "start–end of total" and SHALL disable the previous-page button on page 1 and the next-page button on the last page.

#### Scenario: Default page size
- **WHEN** a visitor first views the archive
- **THEN** the "Per page" control shows 5
- **AND** the range text reads "1–5 of N", where N is the number of playlists matching the selected region

#### Scenario: Changing page size resets to the first page
- **WHEN** a visitor is on page 3 and selects 10 per page
- **THEN** the list shows page 1 with up to 10 playlists
- **AND** the range text reflects the new page size

#### Scenario: Changing region resets to the first page
- **WHEN** a visitor is on page 2 of ALL and selects a region with fewer than 6 playlists
- **THEN** the list shows page 1 of that region's playlists
- **AND** the range text reads "1–N of N", where N is that region's playlist count

#### Scenario: Navigation buttons respect the ends
- **WHEN** a visitor is on page 1
- **THEN** the previous-page button is disabled
- **AND** when the visitor is on the last page the next-page button is disabled

### Requirement: Playlist card expansion
The system SHALL expand and collapse each playlist card when the visitor clicks its header or presses Enter or Space while the header itself has focus, and the header SHALL report whether the card is expanded. Enter or Space on a control inside the header SHALL activate that control and SHALL NOT toggle the card. While a card is collapsed, its tracks and track controls SHALL NOT be reachable with the keyboard or exposed to assistive technology.

#### Scenario: Card expands and collapses
- **WHEN** a visitor clicks a collapsed card header or presses Enter or Space on it
- **THEN** the card expands to show its tracks
- **AND** activating the header again collapses the card

#### Scenario: Collapsed tracks are skipped by the keyboard
- **WHEN** every card is collapsed and a visitor presses Tab from a card's header save button
- **THEN** focus moves to the next card's header, not to a track of the collapsed card

### Requirement: Track preview
The system SHALL open a Spotify player embed for a track when the visitor clicks the track row or its play button, or presses Enter or Space while the row has focus, and SHALL close that embed when the same track is activated again. The system SHALL attempt to start playback in the embed once it loads. Activating the track's Spotify link, by click or keyboard, SHALL open the track on Spotify in a new tab without opening or closing the embed.

#### Scenario: Preview opens and closes
- **WHEN** a visitor clicks a track row
- **THEN** a Spotify embed for that track appears beneath the row
- **AND** clicking the same row again removes the embed

#### Scenario: Spotify link does not toggle preview
- **WHEN** a visitor clicks the "Open ... on Spotify" link on a track row
- **THEN** the track opens on Spotify in a new tab
- **AND** no embed is opened or closed

#### Scenario: Spotify link from the keyboard
- **WHEN** a visitor focuses the "Open ... on Spotify" link on a track row and presses Enter
- **THEN** the track opens on Spotify in a new tab
- **AND** no embed is opened
