# Spec Delta

## ADDED Requirements

### Requirement: Empty fetches do not change archives
When a region's fetch completes successfully but yields no storable tracks, the system SHALL NOT create or modify that region's archive, and SHALL log a warning naming the archive title. The skipped region SHALL NOT stop the remaining regions in the same run from syncing.

#### Scenario: Empty response for an existing week
- **WHEN** a region is re-synced, an archive with its title and region already exists, and Spotify returns a successful response with no items
- **THEN** the existing archive and its track list are left unchanged
- **AND** a warning naming the archive title is logged

#### Scenario: Every item has no track
- **WHEN** a region is synced and every playlist item Spotify returns has no track object
- **THEN** no archive is created or modified for that region

#### Scenario: Empty response for a new week
- **WHEN** a region is synced, no archive exists for its title, and the fetch yields no storable tracks
- **THEN** no archive is created

#### Scenario: Later regions still sync
- **WHEN** one region's fetch yields no storable tracks during a sync run
- **THEN** the remaining regions in that run are still fetched and written

#### Scenario: At least one storable track
- **WHEN** a region's fetch yields at least one storable track, even if other items have no track
- **THEN** the archive is created or updated with those tracks, replacing its track list

## MODIFIED Requirements

### Requirement: Regions and source playlists
The system SHALL sync seven regions, each from its own Spotify playlist: US, UK, CA, BR, MX, DE and AU. The AU archive SHALL come from the playlist that Spotify shares between Australia and New Zealand, and SHALL be stored under region AU.

#### Scenario: Full run
- **WHEN** a sync run completes without error and every region's fetch yields at least one storable track
- **THEN** one archive is written for each of US, UK, CA, BR, MX, DE and AU

#### Scenario: Shared AU and NZ playlist
- **WHEN** the AU region is synced
- **THEN** the source is the Spotify playlist `37i9dQZF1DWT2SPAYawYcO`
- **AND** the archive is stored with region `AU`

### Requirement: One archive per region and week
The system SHALL store at most one archive per combination of title and region. Writing an archive whose title and region already exist SHALL replace that archive's entire track list and update it in place, rather than creating a second record. Each archive's `published_date` SHALL be midnight UTC on the archive's Friday.

#### Scenario: First sync of a new week
- **WHEN** a region is synced, no archive exists for its title, and the fetch yields at least one storable track
- **THEN** a new archive is created with the fetched tracks and a `published_date` of midnight UTC on that Friday

#### Scenario: Re-sync within the same week
- **WHEN** a region is synced again, an archive with the same title and region already exists, and the fetch yields at least one storable track
- **THEN** the existing archive is updated with the newly fetched tracks
- **AND** no duplicate archive is created

#### Scenario: New week
- **WHEN** a region is synced after the Friday changes
- **THEN** a separate archive is created under the new title and the previous week's archive is left unchanged
