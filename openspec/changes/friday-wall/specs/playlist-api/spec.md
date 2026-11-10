# Spec Delta

## ADDED Requirements

### Requirement: Edition index
The system SHALL answer `GET /spotify/editions` with a JSON object `{ "items": [ ... ] }` listing every archived playlist as an edition with `id`, `title`, `region`, `date` and `trackCount`, and without its tracks. Items SHALL be ordered by `date` ascending, and items sharing a `date` SHALL be ordered US, UK, CA, BR, MX, DE, AU. A playlist with no region SHALL be listed with region `US`.

#### Scenario: Index lists editions without tracks
- **WHEN** a client sends `GET /spotify/editions` and the database is reachable
- **THEN** the system responds with status 200 and a JSON body `{ "items": [ ... ] }`
- **AND** each item has `id`, `title`, `region`, `date` and `trackCount`, and no `tracks`

#### Scenario: Index order
- **WHEN** the archive holds US and UK editions for 14 February 2026 and a US edition for 7 February 2026
- **THEN** the 7 February item comes first
- **AND** the US item for 14 February comes before the UK item for 14 February

### Requirement: Edition date
The system SHALL report each edition's `date` as `YYYY-MM-DD`, taken from the date written in the playlist title, in either the form `MM.DD.YYYY` or the form `YYYY-MM-DD`. When the title holds no date, the system SHALL use the UTC calendar date of the playlist's `published_date`.

#### Scenario: Date from a dotted title
- **WHEN** a playlist is titled "New.Music.Friday.11.07.2025" and its `published_date` is 13 November 2025
- **THEN** its edition `date` is `2025-11-07`

#### Scenario: Date from a leading ISO date
- **WHEN** a playlist is titled "2014-12-30 New Music Tuesday"
- **THEN** its edition `date` is `2014-12-30`

#### Scenario: Title without a date
- **WHEN** a playlist's title holds no date and its `published_date` is `2026-02-14T00:00:00Z`
- **THEN** its edition `date` is `2026-02-14`

### Requirement: One edition per region and date
The system SHALL list at most one edition for each combination of region and `date` in the edition index. When several playlists share a region and `date`, the system SHALL list the one with the most tracks, and among those with equal track counts the one with the latest `published_date`.

#### Scenario: Duplicate week
- **WHEN** the archive holds "New.Music.Friday.02.06.2026" and "New.Music.Friday.US.02.06.2026", both for region US with 100 tracks
- **THEN** the index lists one US item dated `2026-02-06`
- **AND** it is the playlist with the later `published_date`

### Requirement: Single edition
The system SHALL answer `GET /spotify/editions/{id}` with a JSON object holding the edition's `id`, `title`, `region`, `date` and `tracks`, where `tracks` is the playlist's full track list in archive order with each track's `id`, `name`, `artist`, `open_url`, `uri` and `added_at`. The system SHALL respond with status 404 and the body `{ "error": "Not found" }` when no playlist has that id, including when the id is malformed.

#### Scenario: Edition found
- **WHEN** a client sends `GET /spotify/editions/{id}` with the id of an archived playlist of 30 tracks
- **THEN** the system responds with status 200
- **AND** `tracks` holds 30 tracks in archive order

#### Scenario: Unknown id
- **WHEN** a client sends `GET /spotify/editions/{id}` with a well-formed id that matches no playlist
- **THEN** the system responds with status 404 and the body `{ "error": "Not found" }`

#### Scenario: Malformed id
- **WHEN** a client sends `GET /spotify/editions/not-an-id`
- **THEN** the system responds with status 404 and the body `{ "error": "Not found" }`

### Requirement: Edition error response
The system SHALL respond with HTTP status 500 and the JSON body `{ "error": "Internal server error" }` when an edition query fails, without exposing the underlying error message to the client.

#### Scenario: Database failure on the index
- **WHEN** a client sends `GET /spotify/editions` and the database query fails
- **THEN** the system responds with status 500
- **AND** the body is `{ "error": "Internal server error" }`

### Requirement: Edition rate limit
The system SHALL allow at most 300 requests per client per 15-minute window to `GET /spotify/editions` and `GET /spotify/editions/{id}` combined, counted separately from the limit on `GET /spotify` and `GET /rss`. Requests beyond that limit SHALL be rejected with HTTP 429 and the JSON body `{ "error": "Too many requests, please try again later." }`.

#### Scenario: Edition limit exceeded
- **WHEN** a client makes its 301st combined request to the edition endpoints within a 15-minute window
- **THEN** the system rejects the request with HTTP 429
- **AND** the body is `{ "error": "Too many requests, please try again later." }`

#### Scenario: Edition requests do not spend the list limit
- **WHEN** a client has made 100 requests to `GET /spotify/editions` within a 15-minute window
- **THEN** its next `GET /spotify` request is not rejected for rate limiting
