# Spec Delta

## MODIFIED Requirements

### Requirement: Single edition
The system SHALL answer `GET /spotify/editions/{id}` with a JSON object holding the edition's `id`, `title`, `region`, `date` and `tracks`, where `tracks` is an object of parallel columns, `{ "id": [...], "name": [...], "artist": [...] }`, holding the playlist's full track list in archive order, so that index N of every column describes the same track. The `tracks` object SHALL also hold a `uri` column and an `open_url` column, each a full array with `null` for a missing value, when at least one track's stored `uri` differs from `spotify:track:<id>` or its stored `open_url` differs from `https://open.spotify.com/track/<id>` respectively, and SHALL omit that column otherwise. The `tracks` object SHALL also hold a `cover` column, a full array of each track's stored cover URL with `null` where a track has none, when at least one track has a stored cover, and SHALL omit that column otherwise. The response SHALL NOT include `added_at`. The system SHALL respond with status 404 and the body `{ "error": "Not found" }` when no playlist has that id, including when the id is malformed.

#### Scenario: Edition found
- **WHEN** a client sends `GET /spotify/editions/{id}` with the id of an archived playlist of 30 tracks
- **THEN** the system responds with status 200
- **AND** `tracks.id`, `tracks.name` and `tracks.artist` each hold 30 entries in archive order
- **AND** `tracks` has no `added_at`

#### Scenario: Derivable fields omitted
- **WHEN** every track of an archived playlist has `uri` equal to `spotify:track:<id>` and `open_url` equal to `https://open.spotify.com/track/<id>`
- **THEN** `GET /spotify/editions/{id}` returns `tracks` without a `uri` or an `open_url` column

#### Scenario: Non-derivable fields sent as full columns
- **WHEN** at least one track of an archived playlist has a `uri` that is empty or differs from `spotify:track:<id>`
- **THEN** `tracks` also holds a `uri` column with one entry per track, `null` where the stored value is missing
- **AND** `tracks` holds an `open_url` column only if some track's `open_url` also differs from its derived value

#### Scenario: Covers sent as a full column
- **WHEN** an archived playlist of 30 tracks has a stored cover on 29 of them
- **THEN** `tracks.cover` holds 30 entries in archive order
- **AND** the entry for the track without a cover is `null`

#### Scenario: No covers stored
- **WHEN** no track of an archived playlist has a stored cover
- **THEN** `tracks` has no `cover` column

#### Scenario: Unknown id
- **WHEN** a client sends `GET /spotify/editions/{id}` with a well-formed id that matches no playlist
- **THEN** the system responds with status 404 and the body `{ "error": "Not found" }`

#### Scenario: Malformed id
- **WHEN** a client sends `GET /spotify/editions/not-an-id`
- **THEN** the system responds with status 404 and the body `{ "error": "Not found" }`

### Requirement: List response shape
The system SHALL answer `GET /spotify` with a JSON object containing `count` and `items`, where `count` is the total number of archived playlists matching the region filter (ignoring pagination) and `items` is the requested page of playlists. The tracks in `items` SHALL NOT include the `cover` field.

#### Scenario: Successful list
- **WHEN** a client sends `GET /spotify` and the database is reachable
- **THEN** the system responds with a JSON body `{ "count": <number>, "items": [ ... ] }`
- **AND** each item is an archived playlist including its `tracks` array

#### Scenario: Count ignores pagination
- **WHEN** a client requests `GET /spotify?size=1&page=2` and 10 playlists exist
- **THEN** `count` is 10
- **AND** `items` contains at most one playlist

#### Scenario: Covers left out of the list
- **WHEN** a client sends `GET /spotify` and the archived tracks have stored covers
- **THEN** no track in `items` has a `cover` field
