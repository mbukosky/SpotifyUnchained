# playlist-api Specification

## Purpose
The playlist-api capability exposes the archived New Music Friday playlists over HTTP so that clients can browse history one page at a time. It lets clients page through results, sort them by publication date, and narrow them to a single supported region, and it protects the endpoint with a per-client request limit.

## Requirements
### Requirement: List response shape
The system SHALL answer `GET /spotify` with a JSON object containing `count` and `items`, where `count` is the total number of archived playlists matching the region filter (ignoring pagination) and `items` is the requested page of playlists.

#### Scenario: Successful list
- **WHEN** a client sends `GET /spotify` and the database is reachable
- **THEN** the system responds with a JSON body `{ "count": <number>, "items": [ ... ] }`
- **AND** each item is an archived playlist including its `tracks` array

#### Scenario: Count ignores pagination
- **WHEN** a client requests `GET /spotify?size=1&page=2` and 10 playlists exist
- **THEN** `count` is 10
- **AND** `items` contains at most one playlist

### Requirement: Pagination parameters
The system SHALL accept `page` and `size` query parameters, defaulting `page` to 1 and `size` to 5, with `page` having a minimum of 1 and `size` having a minimum of 1 and a maximum of 100. A value that is non-numeric or parses to zero SHALL fall back to the default, and a negative value SHALL be raised to the minimum.

#### Scenario: Defaults applied
- **WHEN** a client sends `GET /spotify` with no `page` or `size`
- **THEN** the system returns at most 5 items starting from the first result

#### Scenario: Size clamped to maximum
- **WHEN** a client sends `GET /spotify?size=999`
- **THEN** the system returns at most 100 items

#### Scenario: Size clamped to minimum
- **WHEN** a client sends `GET /spotify?size=-5`
- **THEN** the system returns at most 1 item

#### Scenario: Non-numeric or zero values fall back to default
- **WHEN** a client sends `GET /spotify?size=abc` or `GET /spotify?page=0`
- **THEN** `size` is treated as 5 and `page` is treated as 1 respectively

#### Scenario: Page offset
- **WHEN** a client sends `GET /spotify?page=2&size=10`
- **THEN** the system skips the first 10 results and returns up to 10 items

### Requirement: Sort order by publication date
The system SHALL order results by `published_date` ascending by default, and descending when `sort=desc`. Any other `sort` value SHALL be treated as ascending.

#### Scenario: Default ascending
- **WHEN** a client sends `GET /spotify` with no `sort` parameter
- **THEN** the returned items are ordered from oldest to newest `published_date`

#### Scenario: Descending requested
- **WHEN** a client sends `GET /spotify?sort=desc`
- **THEN** the returned items are ordered from newest to oldest `published_date`

#### Scenario: Unrecognised sort value
- **WHEN** a client sends `GET /spotify?sort=newest`
- **THEN** the returned items are ordered ascending by `published_date`

### Requirement: Region ordering for same-date playlists
The system SHALL break ties between playlists with the same `published_date` by region in the order US, UK, CA, BR, MX, DE, AU, regardless of the `sort` direction.

#### Scenario: Same-date playlists in menu order
- **WHEN** a client lists all regions and the US, UK and CA playlists share a `published_date`
- **THEN** the US item appears before the UK item and the UK item before the CA item within that date

### Requirement: Region filter
The system SHALL filter results to a single region when the `region` query parameter is one of US, UK, CA, BR, MX, DE or AU, matched case-sensitively. A missing or unrecognised `region` value SHALL NOT produce an error and SHALL return results from all regions.

#### Scenario: Valid region filter
- **WHEN** a client sends `GET /spotify?region=UK`
- **THEN** every returned item has `region` equal to `UK`
- **AND** `count` counts only UK playlists

#### Scenario: Unrecognised region ignored
- **WHEN** a client sends `GET /spotify?region=INVALID`
- **THEN** the response includes playlists from all regions and is not an error

#### Scenario: Region match is case-sensitive
- **WHEN** a client sends `GET /spotify?region=uk`
- **THEN** the region is treated as unrecognised and the response includes playlists from all regions

### Requirement: Error response
The system SHALL respond with HTTP status 500 and the JSON body `{ "error": "Internal server error" }` when the list query fails, without exposing the underlying error message to the client.

#### Scenario: Database failure
- **WHEN** a client sends `GET /spotify` and the database query fails
- **THEN** the system responds with status 500
- **AND** the body is `{ "error": "Internal server error" }`

### Requirement: Per-client rate limit
The system SHALL allow at most 100 requests per client per 15-minute window to `GET /spotify` and `GET /rss` combined. Requests beyond that limit SHALL be rejected with HTTP 429 and the JSON body `{ "error": "Too many requests, please try again later." }`.

#### Scenario: Limit exceeded
- **WHEN** a client makes its 101st combined request to `GET /spotify` and `GET /rss` within a 15-minute window, the last being to `GET /spotify`
- **THEN** the system rejects the request with HTTP 429
- **AND** the body is `{ "error": "Too many requests, please try again later." }`

#### Scenario: Feed requests share the limit
- **WHEN** a client has made 100 requests to `GET /rss` within a 15-minute window
- **THEN** its next `GET /spotify` request is rejected with HTTP 429
