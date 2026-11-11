# Spec Delta

## MODIFIED Requirements

### Requirement: Save button at the end of the expanded track list
The system SHALL show a "Save to Spotify" button in the player bar that accompanies the track grid of an open edition panel, with the accessible name "Save playlist to Spotify". The button SHALL be present whether or not a track is open in the player bar.

#### Scenario: Expanded card shows the save button
- **WHEN** a user opens an archived edition in the edition panel
- **THEN** the player bar shows a button labelled "Save to Spotify"
- **AND** the button's accessible name is "Save playlist to Spotify"

### Requirement: Save from the card header
The system SHALL show a save button in the edition panel's header that saves the archive as a new private playlist named by the same rule as the expanded-card save, SHALL NOT close the panel or change the open edition when it is clicked or activated with Enter or Space, and SHALL send every present (non-empty) track URI in the archive without checking their format.

#### Scenario: Header save clicked while signed out
- **WHEN** a signed-out user clicks the header save button
- **THEN** the Spotify sign-in flow starts
- **AND** the panel stays open on the same edition

#### Scenario: Header save from the keyboard
- **WHEN** a signed-in user focuses the header save button and presses Enter or Space
- **THEN** the archive is saved as with a click
- **AND** the panel stays open on the same edition

#### Scenario: Header save succeeds
- **WHEN** a header save completes
- **THEN** the button shows a success check mark and is disabled

#### Scenario: Header save fails
- **WHEN** a header save fails
- **THEN** the button shows an error icon
- **AND** after 3000 ms the button returns to its idle icon
- **AND** no error message text is shown
