# archive-backfill Specification

## Purpose
The archive-backfill capability is a standalone operator script that reconstructs historical weekly New Music Friday playlists for each region from the upstream mackorone/spotify-playlist-archive cumulative data and stores them in the playlists collection. It only writes playlists that do not yet exist, so it can be re-run safely alongside the live sync. It is run by hand and needs no Spotify credentials.

## Requirements
### Requirement: Region selection
The system SHALL process only the regions named in the `BACKFILL_REGIONS` environment variable, parsed as a comma-separated list in which each entry is trimmed and uppercased and empty entries are dropped. When the variable is unset or empty, the system SHALL default to `UK,CA,BR,MX,DE,AU`.

#### Scenario: Default regions
- **WHEN** `BACKFILL_REGIONS` is unset or empty
- **THEN** the run processes UK, CA, BR, MX, DE and AU, in that order
- **AND** US is not processed

#### Scenario: Region without a playlist ID
- **WHEN** `BACKFILL_REGIONS` names a region that has no playlist ID
- **THEN** the system SHALL print a warning for that region
- **AND** continue with the remaining regions

### Requirement: Backfill window length
The system SHALL consider `BACKFILL_WEEKS` Fridays per region, where `BACKFILL_WEEKS` is read as a base-10 integer and defaults to 50 when unset or empty.

#### Scenario: Default window
- **WHEN** `BACKFILL_WEEKS` is unset
- **THEN** 50 Fridays are considered for each region

#### Scenario: Custom window
- **WHEN** `BACKFILL_WEEKS` is set to 200
- **THEN** 200 Fridays are considered for each region

### Requirement: Window anchored to the archive's last change
The system SHALL anchor each region's window to the last change recorded in that region's archive data, not to the current date. That change date is the latest of all Added and Removed dates in the archive, taken as a calendar date. The newest Friday in the window is the most recent Friday on or before that date, and each earlier Friday is one week before the last.

#### Scenario: Anchor falls on a Thursday
- **WHEN** the latest change date is Thursday 18 December 2025
- **THEN** the newest Friday in the window is 12 December 2025

#### Scenario: Anchor falls on a Friday
- **WHEN** the latest change date is Friday 19 December 2025
- **THEN** the newest Friday in the window is 19 December 2025

### Requirement: Source data retrieval
The system SHALL fetch each region's cumulative archive file from `https://raw.githubusercontent.com/mackorone/spotify-playlist-archive/main/playlists/cumulative/<playlist-id>.md`. A non-success HTTP response for a region SHALL be treated as a fatal error that stops the run with exit status 1.

#### Scenario: Archive fetch fails
- **WHEN** the archive returns a non-success HTTP status for a region
- **THEN** the system SHALL report the error and exit with status 1
- **AND** regions already completed earlier in the run keep the playlists they inserted
- **AND** regions after the failed one are not processed

### Requirement: Track row selection
The system SHALL read only table rows, meaning lines that begin with `|`, that split into at least seven pipe-separated cells. The system SHALL include a row only when its title cell is a single markdown link to `https://open.spotify.com/track/<id>`, where `<id>` is made of word characters, the link text is not empty, and the Added cell is a date that parses. Header and separator rows SHALL be ignored.

#### Scenario: Row without a track name
- **WHEN** the title link text is empty
- **THEN** the row is ignored

#### Scenario: Malformed row
- **WHEN** a table row has fewer than seven cells or its title cell is not a track link
- **THEN** the row is ignored

### Requirement: Track field extraction
The system SHALL store each included track's name with backslash escapes for `.`, `(` and `)` removed, and its URI as `spotify:track:<id>`. Added and Removed dates SHALL be read as UTC midnight of the stated day. The system SHALL treat an unparseable Removed cell as absent, and a track with no Removed date SHALL be treated as never removed.

#### Scenario: Escaped characters in a track name
- **WHEN** the title cell is `[Mr\. Smith \(Remix\)](https://open.spotify.com/track/def456)`
- **THEN** the stored name is `Mr. Smith (Remix)`
- **AND** the stored URI is `spotify:track:def456`

#### Scenario: Track still on the playlist
- **WHEN** the Removed cell is empty
- **THEN** the track has no removal date and remains in every Friday snapshot from its added date onward

### Requirement: Primary artist attribution
The system SHALL record as the track's artist the text of the first artist link in the Artist(s) cell, and only when that cell begins with a link to `https://open.spotify.com/artist/`. Otherwise, or when the recorded text is empty after unescaping, the system SHALL record `Unknown`.

#### Scenario: Several artists listed
- **WHEN** the Artist(s) cell is `[First](https://open.spotify.com/artist/a1), [Second](https://open.spotify.com/artist/a2)`
- **THEN** the artist is `First`

#### Scenario: No artist link
- **WHEN** the Artist(s) cell contains no artist link
- **THEN** the artist is `Unknown`

### Requirement: Weekly snapshot reconstruction
The system SHALL build each Friday's track list from every parsed track whose added instant is on or before that Friday's local midnight and that either has no removal date or whose removal instant is after that Friday's local midnight. A Friday whose reconstructed list is empty SHALL NOT be stored and SHALL be counted as an empty week.

#### Scenario: Track removed on the Friday
- **WHEN** a track's removal date is the same calendar date as the Friday and the process time zone is at or west of UTC
- **THEN** the track is not included in that Friday's snapshot

#### Scenario: Track added after the Friday
- **WHEN** a track's added date is later than the Friday
- **THEN** the track is not included in that Friday's snapshot

#### Scenario: No tracks qualify
- **WHEN** no parsed track qualifies for a Friday
- **THEN** no playlist is written for that Friday
- **AND** the Friday is counted as an empty week

### Requirement: Insert-only playlist storage
The system SHALL store each non-empty Friday as a playlist identified by its title and region. The title SHALL be `New.Music.Friday.<REGION>.<MM>.<DD>.<YYYY>` built from the Friday's local date. The playlist's `published_date` SHALL be that Friday's local midnight, and each track SHALL carry `id`, `name`, `artist`, `open_url`, `uri` and `added_at`. The system SHALL NOT modify an existing playlist with the same title and region and SHALL count it as already existing.

#### Scenario: New week
- **WHEN** no playlist with the Friday's title and region exists
- **THEN** the playlist is inserted
- **AND** it is counted as inserted

#### Scenario: Week already stored
- **WHEN** a playlist with the Friday's title and region already exists, for example one saved by the live sync
- **THEN** that playlist is left unchanged
- **AND** it is counted as already existing

#### Scenario: Re-running the script
- **WHEN** the script is run again against the same archive data
- **THEN** no existing playlist is changed
- **AND** every non-empty week is counted as already existing

### Requirement: Per-region run summary
The system SHALL print, after processing each region, a summary line of the form `<REGION>: <n> playlists inserted, <m> already existed, <k> empty weeks skipped`.

#### Scenario: Region completed
- **WHEN** a region finishes processing
- **THEN** the system prints its summary line with the inserted, already-existing and empty-week counts

### Requirement: Entry point and configuration
The system SHALL read `DB_URI` from the environment or a `.env` file. When `DB_URI` is unset or empty, the system SHALL print `DB_URI environment variable is required` and exit with status 1 before connecting to the database. When run directly, the system SHALL connect to MongoDB at `DB_URI`, process the selected regions, and disconnect before exiting. Importing the script as a module SHALL NOT connect to the database or fetch any archive data.

#### Scenario: Missing DB_URI
- **WHEN** `DB_URI` is unset or empty
- **THEN** the system prints `DB_URI environment variable is required`
- **AND** exits with status 1 without connecting

#### Scenario: Imported as a module
- **WHEN** another module imports the script
- **THEN** no database connection is opened and no archive data is fetched
