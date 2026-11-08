## MODIFIED Requirements

### Requirement: Save from the card header
The system SHALL show a save button in each card header that saves the archive as a new private playlist named by the same rule as the expanded-card save, SHALL NOT toggle the card's expanded state when it is clicked or activated with Enter or Space, and SHALL send every present (non-empty) track URI in the archive without checking their format.

#### Scenario: Header save clicked while signed out
- **WHEN** a signed-out user clicks the header save button
- **THEN** the Spotify sign-in flow starts
- **AND** the card does not expand or collapse

#### Scenario: Header save from the keyboard
- **WHEN** a signed-in user focuses the header save button and presses Enter
- **THEN** the archive is saved as with a click
- **AND** the card does not expand or collapse

#### Scenario: Header save succeeds
- **WHEN** a header save completes
- **THEN** the button shows a success check mark and is disabled

#### Scenario: Header save fails
- **WHEN** a header save fails
- **THEN** the button shows an error icon
- **AND** after 3000 ms the button returns to its idle icon
- **AND** no error message text is shown
