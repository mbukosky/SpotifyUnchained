# playlist-sync Specification

## Purpose
The playlist-sync capability is the scheduled job that archives Spotify's "New Music Friday" playlist for each supported region once a week, before Spotify replaces it. Each run fetches the current playlist contents and stores them as one archive record per region and week. Running the job again within the same week refreshes that week's record.

## Requirements

### Requirement: Startup and scheduled sync
The system SHALL run a sync once at server startup, after the database connection is established, and SHALL then run a sync every 8 hours at minute 0 of hours 0, 8 and 16 in the server's local time zone (cron expression `0 */8 * * *`).

#### Scenario: Server starts with sync enabled
- **WHEN** the server starts successfully and connects to MongoDB
- **THEN** a sync run starts immediately
- **AND** a scheduled sync is registered with the cron expression `0 */8 * * *`

#### Scenario: Scheduled tick
- **WHEN** the clock reaches 00:00, 08:00 or 16:00 in the server's local time zone
- **THEN** a sync run starts

#### Scenario: Database connection fails at startup
- **WHEN** the MongoDB connection fails at startup
- **THEN** no sync is started
- **AND** the process exits

### Requirement: Sync can be disabled by environment variable
The system SHALL skip all syncing, including the startup run and the scheduled runs, when the environment variable `SKIP_SPOTIFY_SYNC` is exactly `true`. For any other value, including unset, the system SHALL sync normally.

#### Scenario: Sync disabled
- **WHEN** `SKIP_SPOTIFY_SYNC` is `true`
- **THEN** no Spotify request is made
- **AND** no scheduled sync is registered
- **AND** the server still starts and serves requests

#### Scenario: Sync enabled by default
- **WHEN** `SKIP_SPOTIFY_SYNC` is unset or has any value other than `true`
- **THEN** the startup sync runs and the scheduled sync is registered

### Requirement: Weekly archive title and date
The system SHALL identify each archive by the most recent Friday on or before the run date, using the server's local calendar date. Each archive title SHALL have the format `New.Music.Friday.<REGION>.<MM.DD.YYYY>`, where `<MM.DD.YYYY>` is that Friday's date with zero-padded month and day.

#### Scenario: Sync runs on a Friday
- **WHEN** a sync runs on Friday 2026-02-13
- **THEN** the archive title for each region ends in `.02.13.2026`

#### Scenario: Sync runs later in the week
- **WHEN** a sync runs on Thursday 2026-02-19, Saturday 2026-02-14, or Sunday 2026-02-15
- **THEN** the archive title ends in `.02.13.2026`

#### Scenario: Year boundary
- **WHEN** a sync runs on Wednesday 2025-01-01
- **THEN** the archive title ends in `.12.27.2024`

### Requirement: Regions and source playlists
The system SHALL sync seven regions, each from its own Spotify playlist: US, UK, CA, BR, MX, DE and AU. The AU archive SHALL come from the playlist that Spotify shares between Australia and New Zealand, and SHALL be stored under region AU.

#### Scenario: Full run
- **WHEN** a sync run completes without error
- **THEN** one archive is written for each of US, UK, CA, BR, MX, DE and AU

#### Scenario: Shared AU and NZ playlist
- **WHEN** the AU region is synced
- **THEN** the source is the Spotify playlist `37i9dQZF1DWT2SPAYawYcO`
- **AND** the archive is stored with region `AU`

### Requirement: Spotify authentication
The system SHALL obtain a Spotify access token using the client-credentials grant with the configured client ID and client secret, once at the start of each sync run, and SHALL use that token for every playlist request in the run.

#### Scenario: Token request succeeds
- **WHEN** a sync run starts and Spotify returns a token
- **THEN** every playlist request in that run is sent with that token as a bearer credential

#### Scenario: Token request fails
- **WHEN** the token request returns a non-success HTTP status
- **THEN** no playlist is fetched or written in that run
- **AND** the failure is logged

### Requirement: Fetching all playlist tracks
The system SHALL fetch every track in a region's playlist by requesting pages of up to 100 items and following Spotify's `next` link until none remains. Playlist items that have no track (such as removed or unavailable entries) SHALL be omitted.

#### Scenario: Playlist longer than one page
- **WHEN** Spotify returns a `next` link on the first page
- **THEN** the system requests the next page and includes its tracks
- **AND** the stored track count equals the total number of tracks across all pages, excluding items with no track

#### Scenario: Item without a track
- **WHEN** a playlist item has no track object
- **THEN** that item is not stored

#### Scenario: Playlist request fails
- **WHEN** a playlist page request returns a non-success HTTP status
- **THEN** the region's archive is not written
- **AND** the failure is logged

### Requirement: Stored track fields
The system SHALL store each track with the fields `id`, `name`, `artist`, `added_at`, `open_url` and `uri`. The `artist` value SHALL be the name of the track's first listed artist, or `Unknown` when there is none. `added_at` SHALL be the time the track was added to the playlist, or the sync time when Spotify provides none. `open_url` SHALL be the track's Spotify web URL, and `uri` its Spotify URI; each SHALL be an empty string when Spotify provides none.

#### Scenario: Track with artists
- **WHEN** a track lists artists `Test Artist` and `Other`
- **THEN** the stored `artist` is `Test Artist`

#### Scenario: Track with no artists
- **WHEN** a track has an empty artist list
- **THEN** the stored `artist` is `Unknown`

#### Scenario: Track without an added-at time
- **WHEN** a playlist item has no `added_at` value
- **THEN** the stored `added_at` is the time of the sync run

### Requirement: One archive per region and week
The system SHALL store at most one archive per combination of title and region. Writing an archive whose title and region already exist SHALL replace that archive's entire track list and update it in place, rather than creating a second record. Each archive's `published_date` SHALL be midnight UTC on the archive's Friday.

#### Scenario: First sync of a new week
- **WHEN** a region is synced and no archive exists for its title
- **THEN** a new archive is created with the fetched tracks and a `published_date` of midnight UTC on that Friday

#### Scenario: Re-sync within the same week
- **WHEN** a region is synced again and an archive with the same title and region already exists
- **THEN** the existing archive is updated with the newly fetched tracks
- **AND** no duplicate archive is created

#### Scenario: New week
- **WHEN** a region is synced after the Friday changes
- **THEN** a separate archive is created under the new title and the previous week's archive is left unchanged

### Requirement: Archive record shape
The system SHALL store each archive with the fields `title`, `region`, `published_date` and `tracks`. `region` SHALL be required and SHALL be one of US, UK, CA, BR, MX, DE or AU. Each track SHALL also carry a `created` timestamp set when the track is stored.

#### Scenario: Region outside the supported list
- **WHEN** a record is saved with a region not in the supported list
- **THEN** the save is rejected

### Requirement: Failures do not stop the server
The system SHALL catch errors raised during a sync run, log them, and keep the server running. A failed run SHALL NOT remove or alter the archives of regions that were not written in that run, and the next scheduled run SHALL attempt the sync again.

#### Scenario: Sync run raises an error
- **WHEN** a sync run throws an error
- **THEN** the error is logged
- **AND** the server continues to serve requests
- **AND** the next scheduled run starts normally
