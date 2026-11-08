# playlist-export Specification

## Purpose
Covers saving an archived New Music Friday playlist into the signed-in user's Spotify account as a new private playlist, from the save button at the end of an expanded card and from the save button in each card header. Sign-in, token exchange and profile loading are covered by the Spotify auth spec and are out of scope here, except where they gate a save.

## Requirements
### Requirement: Save button at the end of the expanded track list
The system SHALL show a "Save to Spotify" button as the last element of an expanded playlist card's track list, with the accessible name "Save playlist to Spotify".

#### Scenario: Expanded card shows the save button
- **WHEN** a user expands an archived playlist card
- **THEN** the track list ends with a button labelled "Save to Spotify"
- **AND** the button's accessible name is "Save playlist to Spotify"

### Requirement: Signed-out save starts sign-in
The system SHALL start the Spotify sign-in flow instead of saving when the user is not authenticated, and SHALL NOT make any Spotify playlist request in that case.

#### Scenario: Save clicked while signed out
- **WHEN** a signed-out user clicks the save button in an expanded card
- **THEN** the Spotify sign-in flow starts
- **AND** no playlist is created

### Requirement: Playlist name derived from the archive title
The system SHALL name a saved playlist after the archive title with every "." replaced by a single space, and SHALL make no other change to the title.

#### Scenario: Dotted archive title
- **WHEN** a user saves the archive titled "New.Music.Friday.US.02.14.2026"
- **THEN** the Spotify playlist is named "New Music Friday US 02 14 2026"

### Requirement: Saved playlists are private and owned by the signed-in user
The system SHALL create each saved playlist with `public` set to `false`, using a POST to `/users/{user id}/playlists` where the user id is the signed-in user's Spotify account id.

#### Scenario: Playlist creation request
- **WHEN** a save proceeds past sign-in
- **THEN** a POST is sent to `/users/{user id}/playlists` with a JSON body whose `public` value is `false` and whose `name` is the derived playlist name
- **AND** the request is sent before any track is added

### Requirement: Account id lookup for the expanded-card save
The system SHALL, when saving from an expanded card, use the signed-in user's cached Spotify account id when one is available, and otherwise SHALL first fetch the current user from `/me` and use that id before creating the playlist.

#### Scenario: Cached profile unavailable
- **WHEN** an expanded-card save runs and no cached account id is available
- **THEN** a GET to `/me` is sent first
- **AND** the playlist is created under the id returned by that request

### Requirement: Expanded-card save sends only valid track URIs
The system SHALL, when saving from an expanded card, send only track URIs that match `spotify:track:` followed by exactly 22 letters or digits, SHALL skip every other entry, and SHALL NOT call Spotify when no valid URI remains.

#### Scenario: Archive with some malformed entries
- **WHEN** an archive contains valid track URIs together with empty or malformed entries
- **THEN** only the valid track URIs are added to the playlist

#### Scenario: Archive with no valid URIs
- **WHEN** an archive has no valid track URIs
- **THEN** no request is sent to Spotify
- **AND** the save reports the error "This archive has no saveable tracks."

### Requirement: Tracks are added in batches of up to 100
The system SHALL add tracks to the new playlist with POST requests to `/playlists/{playlist id}/tracks`, each body `{ "uris": [...] }` containing at most 100 URIs, in archive order.

#### Scenario: More than 100 tracks
- **WHEN** an archive has 250 valid track URIs
- **THEN** three POST requests are sent to `/playlists/{playlist id}/tracks`, carrying 100, 100 and 50 URIs in archive order

### Requirement: Expanded-card save button states
The system SHALL show "Saving..." and disable the save button while a save is in progress, SHALL show "Saved!" and keep the button disabled after a successful save, and SHALL show "Error" and re-enable the button after a failed save.

#### Scenario: Successful save
- **WHEN** a save completes without error
- **THEN** the button reads "Saved!" and is disabled

#### Scenario: Failed save reverts after six seconds
- **WHEN** a save fails
- **THEN** the button reads "Error"
- **AND** the error message is shown in an alert beneath the button
- **AND** after 6000 ms the button returns to "Save to Spotify" and the message is removed

### Requirement: Error messages for the expanded-card save
The system SHALL show these messages for a failed save: for HTTP 401, "Your Spotify session expired. Sign in again and retry."; for HTTP 403, "Spotify denied the request. Sign in again to grant playlist access."; for HTTP 429, "Spotify is busy right now. Try again in a minute."; for any other failure, the error's own message, or "Something went wrong saving this playlist." when there is none.

#### Scenario: Rate limited after retries
- **WHEN** Spotify still answers HTTP 429 after the retries are exhausted
- **THEN** the alert reads "Spotify is busy right now. Try again in a minute."

#### Scenario: Unrecognised failure
- **WHEN** a save fails with an error that has no HTTP status and no message
- **THEN** the alert reads "Something went wrong saving this playlist."

### Requirement: Rate-limit retries for Spotify requests
The system SHALL retry a Spotify request that receives HTTP 429 at most twice, waiting the number of seconds given by the `Retry-After` header, capped at 10 seconds and defaulting to 1 second when the header is missing or zero. After the last retry fails, the request SHALL fail with the HTTP status 429.

#### Scenario: Retry-After honoured
- **WHEN** Spotify answers HTTP 429 with `Retry-After: 1` and then succeeds
- **THEN** the request is repeated after one second
- **AND** the save completes

#### Scenario: Retry-After capped
- **WHEN** Spotify answers HTTP 429 with `Retry-After: 60`
- **THEN** the wait before the retry is 10 seconds

### Requirement: Save from the card header
The system SHALL show a save button in each card header that saves the archive as a new private playlist named by the same rule as the expanded-card save, SHALL NOT toggle the card's expanded state when it is clicked or activated with Enter or Space, and SHALL send every present (non-empty) track URI in the archive without checking their format.

#### Scenario: Header save clicked while signed out
- **WHEN** a signed-out user clicks the header save button
- **THEN** the Spotify sign-in flow starts
- **AND** the card does not expand or collapse

#### Scenario: Header save from the keyboard
- **WHEN** a signed-in user focuses the header save button and presses Enter or Space
- **THEN** the archive is saved as with a click
- **AND** the card does not expand or collapse

#### Scenario: Header save succeeds
- **WHEN** a header save completes
- **THEN** the button shows a success check mark and is disabled

#### Scenario: Header save fails
- **WHEN** a header save fails
- **THEN** the button shows an error icon
- **AND** after 3000 ms the button returns to its idle icon
- **AND** no error message text is shown
