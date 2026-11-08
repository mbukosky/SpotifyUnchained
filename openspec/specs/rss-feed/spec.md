# rss-feed Specification

## Purpose
The RSS feed publishes the archived New Music Friday playlists as an RSS 2.0 document so that feed readers can follow new archives. It exposes the most recent archived playlists, optionally filtered to a single region, with each playlist's tracks listed as links to Spotify.

## Requirements

### Requirement: Feed response format and caching
The system SHALL answer `GET /rss` with HTTP 200, a `Content-Type` of `application/rss+xml; charset=utf-8`, and a `Cache-Control` of `public, max-age=3600`. The body SHALL be an XML document beginning with `<?xml version="1.0" encoding="UTF-8"?>` and containing an `<rss version="2.0">` root with a single `<channel>`.

#### Scenario: Successful feed request
- **WHEN** a client sends `GET /rss` and the archive query succeeds
- **THEN** the response status is 200
- **AND** the `Content-Type` header is `application/rss+xml; charset=utf-8`
- **AND** the `Cache-Control` header is `public, max-age=3600`
- **AND** the body is an RSS 2.0 document with one `<channel>`

### Requirement: Region filtering
The system SHALL filter feed items by the `region` query parameter when its value is exactly one of `US`, `UK`, `CA`, `BR`, `MX`, `DE`, or `AU`. The system SHALL NOT filter by region when the parameter is absent, empty, or any other value, including lowercase region codes, unknown codes, or a repeated parameter; in those cases it SHALL include archived playlists from all regions.

#### Scenario: Valid region filter
- **WHEN** a client sends `GET /rss?region=UK`
- **THEN** only playlists whose region is `UK` are included as items

#### Scenario: Invalid region value is ignored
- **WHEN** a client sends `GET /rss?region=INVALID`
- **THEN** playlists from all regions are eligible for inclusion
- **AND** the response is not an error

#### Scenario: Lowercase region code is not normalized
- **WHEN** a client sends `GET /rss?region=us`
- **THEN** the region filter is not applied
- **AND** playlists from all regions are eligible for inclusion

### Requirement: Channel metadata
The system SHALL set the channel `<title>` to `Spotify Unchained — New Music Friday (<label>)`, where `<label>` is the requested region code or `All Regions` when no valid region filter applies. The channel `<description>` SHALL be `Weekly archive of Spotify's New Music Friday playlist (<label>)`. The channel `<link>` SHALL be `https://spotifyunchained.com`.

#### Scenario: Region-specific channel title
- **WHEN** a client sends `GET /rss?region=AU`
- **THEN** the channel title is `Spotify Unchained — New Music Friday (AU)`
- **AND** the channel description is `Weekly archive of Spotify's New Music Friday playlist (AU)`

#### Scenario: Unfiltered channel title
- **WHEN** a client sends `GET /rss` with no valid region parameter
- **THEN** the channel title is `Spotify Unchained — New Music Friday (All Regions)`
- **AND** the channel `<link>` is `https://spotifyunchained.com`

### Requirement: Item selection and ordering
The system SHALL include at most 50 items, selected from the archived playlists after the region filter is applied, ordered by publication date (`published_date`) from newest to oldest. When no playlists match, the system SHALL still return a valid channel with no `<item>` elements.

#### Scenario: More than 50 archived playlists
- **WHEN** more than 50 archived playlists are eligible
- **THEN** the feed contains exactly 50 items
- **AND** the items are the 50 most recent by `published_date`, newest first

#### Scenario: No matching playlists
- **WHEN** a client requests a region that has no archived playlists
- **THEN** the response is a valid RSS document with a `<channel>` and no `<item>` elements
- **AND** the response status is 200

### Requirement: Item fields
The system SHALL emit one `<item>` per playlist with a `<title>` set to the playlist title, a `<link>` set to `https://spotifyunchained.com`, a `<guid>` set to the playlist's permalink, a `<pubDate>` set to its publication date, and a `<description>` holding an HTML list of its tracks.

#### Scenario: Playlist with tracks
- **WHEN** an archived playlist has a track named `Test Track` by `Test Artist` with open URL `https://open.spotify.com/track/123`
- **THEN** its `<item>` has `<title>` equal to the playlist title
- **AND** its `<pubDate>` is the playlist's `published_date` as a UTC date string (for example `Sat, 14 Feb 2026 00:00:00 GMT`)
- **AND** its `<description>` CDATA contains `<ul>` with a list item linking to `https://open.spotify.com/track/123` whose text is `Test Track &mdash; Test Artist`
- **AND** the playlist's tracks appear as list items in stored order, one per track

#### Scenario: Playlist identifier as guid
- **WHEN** an archived playlist has identifier `507f1f77bcf86cd799439011`
- **THEN** its `<guid>` is `https://spotifyunchained.com/playlist/507f1f77bcf86cd799439011`

### Requirement: XML escaping of feed text
The system SHALL escape the characters `&`, `<`, `>`, `"`, and `'` as `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&apos;` in channel `<title>`, `<link>`, and `<description>`, and in item `<title>`, `<link>`, and `<guid>`. In item descriptions, the system SHALL escape each track's name and artist before placing them inside the CDATA section, and SHALL NOT escape them a second time.

#### Scenario: Special characters in track data
- **WHEN** a track is named `Rock & Roll <Live>` by an artist named `Artist "X"`
- **THEN** the item description CDATA contains `Rock &amp; Roll &lt;Live&gt;`
- **AND** it contains `Artist &quot;X&quot;`
- **AND** the text is not double-escaped

### Requirement: Error response
The system SHALL respond to a failure while building the feed with HTTP 500, the media type `text/plain`, and the body `Internal server error`. The error response SHALL NOT include an XML body, error details, or a `Cache-Control` header set by the feed.

#### Scenario: Database failure
- **WHEN** reading archived playlists fails
- **THEN** the response status is 500
- **AND** the media type is `text/plain`
- **AND** the body is `Internal server error`

### Requirement: Rate limiting
The system SHALL limit each client IP address to 100 requests per 15-minute window on `GET /rss`. This limit SHALL share a counter with `GET /spotify`. When the limit is exceeded, the system SHALL respond with HTTP 429 and a JSON body of `{"error":"Too many requests, please try again later."}`.

#### Scenario: Request over the limit
- **WHEN** a client has already made 100 requests to `/rss` or `/spotify` within the current 15-minute window
- **THEN** the next `GET /rss` request receives HTTP 429
- **AND** the body is `{"error":"Too many requests, please try again later."}`

### Requirement: Feed discovery links
The system SHALL advertise the feed in the site's HTML head with a `<link rel="alternate" type="application/rss+xml" title="Spotify Unchained RSS" href="/rss">` element. The site header SHALL include a link to `/rss` with the accessible label `RSS Feed` that opens in a new tab.

#### Scenario: Feed autodiscovery
- **WHEN** a feed reader loads the site's home page
- **THEN** the page head contains an RSS alternate link titled `Spotify Unchained RSS` pointing to `/rss`

#### Scenario: Header feed link
- **WHEN** a visitor views the site header
- **THEN** a link to `/rss` labelled `RSS Feed` is present
- **AND** it opens in a new browser tab
