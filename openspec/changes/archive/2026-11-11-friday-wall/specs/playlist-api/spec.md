# Spec Delta

## ADDED Requirements

### Requirement: Edition index
The system SHALL answer `GET /spotify/editions` with a JSON object `{ "items": [ ... ] }` listing every archived playlist as an edition with `id`, `region`, `date` and `trackCount`, and without its tracks or title. An item SHALL also carry `"tuesday": true` when its playlist title contains the word "Tuesday" in any letter case, and SHALL carry no `tuesday` key otherwise. Items SHALL be ordered by `date` ascending, and items sharing a `date` SHALL be ordered US, UK, CA, BR, MX, DE, AU. A playlist with no region SHALL be listed with region `US`.

#### Scenario: Index lists editions without tracks
- **WHEN** a client sends `GET /spotify/editions` and the database is reachable
- **THEN** the system responds with status 200 and a JSON body `{ "items": [ ... ] }`
- **AND** each item has `id`, `region`, `date` and `trackCount`, and no `tracks` or `title`

#### Scenario: Tuesday flag
- **WHEN** the archive holds a playlist titled "2015-07-07 New Music Tuesday" and one titled "New.Music.Friday.US.07.10.2015"
- **THEN** the item for the Tuesday playlist has `"tuesday": true`
- **AND** the item for the Friday playlist has no `tuesday` key

#### Scenario: Index order
- **WHEN** the archive holds US and UK editions for 14 February 2026 and a US edition for 7 February 2026
- **THEN** the 7 February item comes first
- **AND** the US item for 14 February comes before the UK item for 14 February

### Requirement: Edition date
The system SHALL report each edition's `date` as `YYYY-MM-DD`, taken from the date written in the playlist title, in either the form `MM.DD.YYYY` or the form `YYYY-MM-DD`. When the title holds no date, the system SHALL use the UTC calendar date of the playlist's `published_date`.

#### Scenario: Date from a dotted title
- **WHEN** a playlist is titled "New.Music.Friday.11.07.2025" and its `published_date` is 13 November 2025
- **THEN** the index item for that playlist has `date` `2025-11-07`

#### Scenario: Date from a leading ISO date
- **WHEN** a playlist is titled "2014-12-30 New Music Tuesday"
- **THEN** the index item for that playlist has `date` `2014-12-30`

#### Scenario: Title without a date
- **WHEN** a playlist's title holds no date and its `published_date` is `2026-02-14T00:00:00Z`
- **THEN** the index item for that playlist has `date` `2026-02-14`

### Requirement: One edition per region and date
The system SHALL list at most one edition for each combination of region and `date` in the edition index. When several playlists share a region and `date`, the system SHALL list the one with the most tracks, and among those with equal track counts the one with the latest `published_date`.

#### Scenario: Duplicate week
- **WHEN** the archive holds "New.Music.Friday.02.06.2026" and "New.Music.Friday.US.02.06.2026", both for region US with 100 tracks
- **THEN** the index lists one US item dated `2026-02-06`
- **AND** it is the playlist with the later `published_date`

### Requirement: Single edition
The system SHALL answer `GET /spotify/editions/{id}` with a JSON object holding the edition's `id`, `title`, `region`, `date` and `tracks`, where `tracks` is an object of parallel columns, `{ "id": [...], "name": [...], "artist": [...] }`, holding the playlist's full track list in archive order, so that index N of every column describes the same track. The `tracks` object SHALL also hold a `uri` column and an `open_url` column, each a full array with `null` for a missing value, when at least one track's stored `uri` differs from `spotify:track:<id>` or its stored `open_url` differs from `https://open.spotify.com/track/<id>` respectively, and SHALL omit that column otherwise. The response SHALL NOT include `added_at`. The system SHALL respond with status 404 and the body `{ "error": "Not found" }` when no playlist has that id, including when the id is malformed.

#### Scenario: Edition found
- **WHEN** a client sends `GET /spotify/editions/{id}` with the id of an archived playlist of 30 tracks
- **THEN** the system responds with status 200
- **AND** `tracks.id`, `tracks.name` and `tracks.artist` each hold 30 entries in archive order
- **AND** `tracks` has no `added_at`

#### Scenario: Derivable fields omitted
- **WHEN** every track of an archived playlist has `uri` equal to `spotify:track:<id>` and `open_url` equal to `https://open.spotify.com/track/<id>`
- **THEN** `GET /spotify/editions/{id}` returns `tracks` with only the `id`, `name` and `artist` columns

#### Scenario: Non-derivable fields sent as full columns
- **WHEN** at least one track of an archived playlist has a `uri` that is empty or differs from `spotify:track:<id>`
- **THEN** `tracks` also holds a `uri` column with one entry per track, `null` where the stored value is missing
- **AND** `tracks` holds an `open_url` column only if some track's `open_url` also differs from its derived value

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
The system SHALL allow at most 900 requests per client per 15-minute window to `GET /spotify/editions` and `GET /spotify/editions/{id}` combined, counted separately from the limit on `GET /spotify` and `GET /rss`. Requests beyond that limit SHALL be rejected with HTTP 429 and the JSON body `{ "error": "Too many requests, please try again later." }`.

#### Scenario: Edition limit exceeded
- **WHEN** a client makes its 901st combined request to the edition endpoints within a 15-minute window
- **THEN** the system rejects the request with HTTP 429
- **AND** the body is `{ "error": "Too many requests, please try again later." }`

#### Scenario: Edition requests do not spend the list limit
- **WHEN** a client has made 100 requests to `GET /spotify/editions` within a 15-minute window
- **THEN** its next `GET /spotify` request is not rejected for rate limiting

### Requirement: Compressed, revalidatable archive responses
The system SHALL serve `GET /spotify/editions`, `GET /spotify/editions/{id}` and `GET /spotify` pages whose JSON body is at most 128 kB from a pre-compressed in-memory cache, choosing the encoding from the request's `Accept-Encoding`, and SHALL send each such response with a strong `ETag` and `Vary: Accept-Encoding`. The system SHALL respond with status 304 and no body when the request's `If-None-Match` matches the response's `ETag`. `GET /spotify` pages larger than 128 kB SHALL be neither pre-encoded nor cached; they are compressed per request by the compression middleware and carry no such `ETag`. The body content of `GET /spotify` SHALL be unchanged.

#### Scenario: Conditional request matches
- **WHEN** a client sends `GET /spotify/editions` and then repeats it with `If-None-Match` set to the `ETag` of the first response
- **THEN** the second response has status 304 and an empty body

#### Scenario: Validators and encoding
- **WHEN** a client sends `GET /spotify/editions` with `Accept-Encoding: gzip`
- **THEN** the response has a strong `ETag` and `Vary` containing `Accept-Encoding`
- **AND** the body, once decoded, is the same JSON as an uncompressed response
