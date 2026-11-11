# Spec Delta

## MODIFIED Requirements

### Requirement: Stored track fields
The system SHALL store each track with the fields `id`, `name`, `artist`, `added_at`, `open_url`, `uri` and `cover`. The `artist` value SHALL be the name of the track's first listed artist, or `Unknown` when there is none. `added_at` SHALL be the time the track was added to the playlist, or the sync time when Spotify provides none. `open_url` SHALL be the track's Spotify web URL, and `uri` its Spotify URI; each SHALL be an empty string when Spotify provides none. `cover` SHALL be the URL of the track's album image that is 300 pixels wide, or the widest image when none is 300 pixels wide, or an empty string when Spotify provides no album image.

#### Scenario: Track with artists
- **WHEN** a track lists artists `Test Artist` and `Other`
- **THEN** the stored `artist` is `Test Artist`

#### Scenario: Track with no artists
- **WHEN** a track has an empty artist list
- **THEN** the stored `artist` is `Unknown`

#### Scenario: Track without an added-at time
- **WHEN** a playlist item has no `added_at` value
- **THEN** the stored `added_at` is the time of the sync run

#### Scenario: Track with album images
- **WHEN** a track's album lists images 640, 300 and 64 pixels wide
- **THEN** the stored `cover` is the URL of the 300-pixel image

#### Scenario: Track without a 300-pixel image
- **WHEN** a track's album lists only a 640-pixel image
- **THEN** the stored `cover` is the URL of that image

#### Scenario: Track without album images
- **WHEN** a track has no album, or its album lists no images
- **THEN** the stored `cover` is an empty string
