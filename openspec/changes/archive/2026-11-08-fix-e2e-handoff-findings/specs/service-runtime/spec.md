## MODIFIED Requirements

### Requirement: JSON 404 for unmatched routes
The system SHALL answer any request that no route handles with status `404` and body `{"error":"Not found"}`.

#### Scenario: Unknown route
- **WHEN** a client sends a POST to `/definitely/not/a/route`
- **THEN** the response is status 404 with body `{"error":"Not found"}`
