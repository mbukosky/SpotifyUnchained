# archive-browsing Specification

## Purpose
This capability covers the public web page where visitors browse archived New Music Friday playlists. It defines the region filter, the default and remembered region, the archive list with its ordering and pagination, playlist cards and their track lists, track previews, outbound links, and the page's loading, empty and error states. Saving to Spotify and sign-in are specified elsewhere.

## Requirements

### Requirement: Region selector
The system SHALL show a region selector in the page header with the buttons ALL, US, UK, CA, BR, MX, DE and AU, in that order, and SHALL mark the currently selected region as active. The AU button SHALL display "AU", SHALL cycle to show "NZ" on the back face, and SHALL be named "Australia & New Zealand" for assistive technology.

#### Scenario: Selector lists every region in order
- **WHEN** a visitor views the page header
- **THEN** the system shows the buttons ALL, US, UK, CA, BR, MX, DE and AU in that order
- **AND** the button for the current region is marked active

#### Scenario: AU button presents both countries
- **WHEN** a visitor hovers over or focuses the AU button on a device that supports hover
- **THEN** the button flips to show "NZ"
- **AND** on a touch device without hover the button flips back and forth on a repeating loop

### Requirement: Default and remembered region
The system SHALL select the ALL region when a visitor has no previously saved region choice. The system SHALL save each region the visitor selects in the browser's local storage under the key `selectedRegion`, and SHALL restore that region when the page is loaded again in the same browser.

#### Scenario: First visit defaults to ALL
- **WHEN** a visitor opens the page with no saved region choice
- **THEN** the ALL button is active
- **AND** playlists from every region are listed

#### Scenario: Choice survives a reload
- **WHEN** a visitor selects UK and then reloads the page
- **THEN** the UK button is active after the reload
- **AND** only UK playlists are listed

### Requirement: Region accent colors
The system SHALL give each region a fixed accent color: US `#f5c451`, UK `#6db9ff`, CA `#ff6b6b`, BR `#5ce08a`, MX `#ff7ee2`, DE `#5ee6d0` and AU `#b48cff`. The active region button SHALL be filled with its region's accent color, and the ALL button SHALL be filled white. The page background SHALL shift toward the selected region's accent color, and return to its default violet, cyan and magenta blend when ALL is selected.

#### Scenario: Active region button takes its accent
- **WHEN** a visitor selects CA
- **THEN** the CA button is filled with `#ff6b6b`
- **AND** the ALL button is filled white when ALL is selected

#### Scenario: Background follows the selected region
- **WHEN** a visitor selects BR
- **THEN** the page background gradually shifts toward `#5ce08a`
- **AND** selecting ALL gradually returns the background to its default colors

### Requirement: Archive filtering and order
The system SHALL list only playlists for the selected region, except that ALL SHALL list playlists from every region. The system SHALL list playlists newest first by publication date. When two playlists have an identical publication timestamp, the system SHALL list them in the order US, UK, CA, BR, MX, DE, AU.

#### Scenario: Region filter narrows the list
- **WHEN** a visitor selects DE
- **THEN** every listed playlist has the region DE

#### Scenario: ALL shows newest first across regions
- **WHEN** a visitor selects ALL
- **THEN** playlists from every region are listed with the most recently published first
- **AND** playlists with an identical publication timestamp are ordered US, UK, CA, BR, MX, DE, then AU

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

### Requirement: Loading, empty and error states
The system SHALL show a spinner with the text "Loading playlists..." while playlists are being fetched. The system SHALL show the text "Failed to load playlists. Please try again." when the fetch fails. The system SHALL show "No playlists found" with the hint "Try selecting a different region filter." when the fetch succeeds with no playlists. The system SHALL hide the pagination controls during loading, error and empty states.

#### Scenario: Loading state while fetching
- **WHEN** a visitor changes the region, page or page size
- **THEN** the spinner and "Loading playlists..." are shown until the request completes

#### Scenario: Request fails
- **WHEN** the playlist request returns an error or cannot complete
- **THEN** the system shows "Failed to load playlists. Please try again."
- **AND** no pagination controls are shown

#### Scenario: No playlists match
- **WHEN** the request succeeds with no playlists
- **THEN** the system shows "No playlists found" and "Try selecting a different region filter."
- **AND** no pagination controls are shown

### Requirement: Playlist card content
The system SHALL show each playlist as a card with its title, its publication date and its track count. The title SHALL be displayed with each period surrounded by spaces, and any region code in the title (US, UK, CA, BR, MX, DE or AU) SHALL be shown in that region's accent color. The publication date SHALL be shown in the form "Month day, year", in the visitor's local time zone. The track count SHALL read "N tracks". A card whose region is missing SHALL use US as its accent color.

#### Scenario: Card shows title, date and count
- **WHEN** a card for "New.Music.Friday.US.02.14.2026", published at midnight UTC on 14 February 2026 with 30 tracks, is listed to a visitor in the UTC time zone
- **THEN** the title shows the code "US" in the US accent color
- **AND** the card shows "February 14, 2026" and "30 tracks"

### Requirement: Playlist card expansion
The system SHALL expand and collapse each playlist card when the visitor clicks its header or presses Enter or Space while the header itself has focus, and the header SHALL report whether the card is expanded. Enter or Space on a control inside the header SHALL activate that control and SHALL NOT toggle the card. While a card is collapsed, its tracks and track controls SHALL NOT be reachable with the keyboard or exposed to assistive technology.

#### Scenario: Card expands and collapses
- **WHEN** a visitor clicks a collapsed card header or presses Enter or Space on it
- **THEN** the card expands to show its tracks
- **AND** activating the header again collapses the card

#### Scenario: Collapsed tracks are skipped by the keyboard
- **WHEN** every card is collapsed and a visitor presses Tab from a card's header save button
- **THEN** focus moves to the next card's header, not to a track of the collapsed card
- **AND** the collapsed card's track controls are absent from the accessibility tree
- **AND** once that card is expanded, Tab from the same button moves to its first track

### Requirement: Track listing
The system SHALL show every track of an expanded playlist with a two-digit position number starting at 01, the track name and the track's artist. The system SHALL NOT limit the number of tracks shown, and the expanded list SHALL show all tracks without being clipped.

#### Scenario: Long playlist shows every track
- **WHEN** a visitor expands a playlist with 50 tracks
- **THEN** tracks numbered 01 through 50 are shown
- **AND** the last track is fully visible when scrolled to

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
- **AND** no embed is opened or closed

### Requirement: Outbound links
The system SHALL provide these links, each opening in a new tab: a PayPal donation link `https://paypal.me/mbukosky/1` and a GitHub link `https://github.com/mbukosky/SpotifyUnchained` in the header, a "Buy me a coffee" link `https://ko-fi.com/A1439LK` in the archive heading, and a GitHub link in the footer. The footer SHALL state that the site is not an official Spotify application.

#### Scenario: Donation and project links
- **WHEN** a visitor activates the PayPal, GitHub or Ko-fi link
- **THEN** the corresponding page opens in a new tab

#### Scenario: Disclaimer is visible
- **WHEN** a visitor scrolls to the footer
- **THEN** the footer reads "Not an official Spotify application. Built for music lovers who never want to miss a track."

### Requirement: Reduced motion and pointer effects
The system SHALL respect the operating system's reduced-motion preference. When reduced motion is requested, the background SHALL be drawn once as a still image without animation, and CSS animations and transitions SHALL complete almost instantly. The background pointer parallax and the playlist card tilt-and-pluck effects SHALL be active only on devices with a fine pointer and only when reduced motion is not requested.

#### Scenario: Reduced motion requested
- **WHEN** a visitor's system requests reduced motion
- **THEN** the background is displayed as a still frame
- **AND** CSS animations and transitions finish almost instantly

#### Scenario: Touch device without fine pointer
- **WHEN** a visitor uses a touch device without a fine pointer
- **THEN** moving the pointer does not parallax the background
- **AND** playlist cards do not tilt

### Requirement: Analytics
The system SHALL load the Google Analytics 4 tag with measurement ID `G-4WWQ1NYF17` on every page load. The system SHALL NOT send custom analytics events from the archive page.

#### Scenario: Page load is tagged
- **WHEN** a visitor loads the page
- **THEN** the GA4 tag for `G-4WWQ1NYF17` is loaded and configured
