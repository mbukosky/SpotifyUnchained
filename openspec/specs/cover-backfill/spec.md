# cover-backfill Specification

## Purpose
Adds album cover URLs to tracks archived before the sync began storing them, so every edition can show its covers without the visitor's browser asking Spotify.

## Requirements

### Requirement: Fill missing covers only
The script SHALL set `cover` on archived tracks that have no stored cover and for which Spotify returns an album image, choosing the image by the same rule as the sync. It SHALL NOT change a track that already has a cover, any other track field, the order or number of tracks, or any playlist field, and SHALL NOT create or delete playlists.

#### Scenario: Track without a cover
- **WHEN** the script runs and an archived track has no `cover` and Spotify returns album images for its id
- **THEN** the track's `cover` is set to the URL of the 300-pixel image
- **AND** the track's other fields and its position in the playlist are unchanged

#### Scenario: Track that already has a cover
- **WHEN** the script runs and an archived track already has a non-empty `cover`
- **THEN** that track is not written

#### Scenario: Track Spotify no longer has
- **WHEN** Spotify returns no track, or no album image, for an archived track id
- **THEN** that track is left without a cover
- **AND** the script continues with the remaining tracks

### Requirement: One lookup per distinct track
The script SHALL look each distinct track id up at most once per run, through Spotify's Web API with the application's client credentials, and SHALL apply the result to every archived playlist that holds that track.

#### Scenario: Track in several editions
- **WHEN** the same track id appears in the US and CA editions of one week
- **THEN** the script asks Spotify for it once
- **AND** both editions' tracks receive the cover

### Requirement: Spotify rate limits honoured
The script SHALL wait for the time given in `Retry-After` when Spotify answers 429 and then repeat that request, and SHALL stop with a non-zero exit status, leaving the covers already written in place, when Spotify answers with any other error status for a lookup request.

#### Scenario: Rate limited
- **WHEN** Spotify answers a lookup with status 429 and `Retry-After: 5`
- **THEN** the script waits at least five seconds and sends the same lookup again

#### Scenario: Spotify error
- **WHEN** Spotify answers a lookup with status 500
- **THEN** the script exits with a non-zero status
- **AND** covers written before the error remain stored

### Requirement: Safe to rerun
The script SHALL be idempotent: a run after a completed run SHALL write nothing, and a run after an interrupted run SHALL look up only tracks still without a cover.

#### Scenario: Second run
- **WHEN** the script runs twice and Spotify's answers do not change
- **THEN** the second run writes no tracks

### Requirement: Dry run
The script SHALL write nothing to the database when started with `--dry-run`, and SHALL report the number of playlists and tracks it would update.

#### Scenario: Dry run
- **WHEN** the script is started with `--dry-run` against an archive with tracks missing covers
- **THEN** it prints how many tracks and playlists would be updated
- **AND** no stored track changes

### Requirement: Run summary
The script SHALL print, when it finishes, the number of distinct tracks looked up, the number for which a cover was found, the number left without one, and the number of playlists and tracks updated.

#### Scenario: Completed run
- **WHEN** the script finishes
- **THEN** it prints the counts of tracks looked up, covers found, tracks left without a cover, and playlists and tracks updated

### Requirement: Entry point and configuration
The script SHALL be run directly as `node scripts/backfill-covers.js`, reading `DB_URI`, `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from the environment or a `.env` file, and SHALL exit with a non-zero status and a message naming the missing variable when one is absent.

#### Scenario: Missing credentials
- **WHEN** the script is started without `SPOTIFY_CLIENT_SECRET`
- **THEN** it exits with a non-zero status and names the missing variable
- **AND** nothing is written
