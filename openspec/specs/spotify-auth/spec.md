# spotify-auth Specification

## Purpose
This capability lets a visitor sign in to their Spotify account using OAuth 2.0 Authorization Code with PKCE, so the app can act on their behalf (creating playlists and adding tracks). The browser never holds the client secret: the server exchanges and refreshes tokens, and the browser keeps the resulting session in `sessionStorage`. It also covers how the session ends, whether by expiry, a failed refresh, or sign-out, and how the user is told when re-authorization is needed.

## Requirements
### Requirement: PKCE sign-in redirect
The system SHALL start sign-in by generating a PKCE code verifier and a state value, storing both in `sessionStorage`, and redirecting the browser to the Spotify authorization endpoint with an S256 code challenge.

#### Scenario: User clicks Sign in
- **WHEN** a signed-out visitor activates the "Sign in with Spotify" control
- **THEN** the code verifier is 128 characters and the state is 64 characters, each drawn from `A-Z a-z 0-9 - . _ ~`
- **AND** the browser navigates to `https://accounts.spotify.com/authorize` with `client_id`, `response_type=code`, `redirect_uri` set to the page origin plus `/callback`, `scope` set to `playlist-modify-public playlist-modify-private`, `code_challenge_method=S256`, the SHA-256 `code_challenge` derived from the verifier, and `state`
- **AND** the verifier and state are stored under the keys `spotify_code_verifier` and `spotify_auth_state`

### Requirement: Callback state validation
The system SHALL process an authorization callback only when the `state` query parameter is present and equals the stored state value. When the check fails, the system MUST NOT call the token endpoint, MUST remove the stored state and code verifier, and MUST remove the query string from the URL.

#### Scenario: Matching state
- **WHEN** the page loads with a `code` and a `state` that equals the stored state
- **THEN** the stored state is removed from `sessionStorage`
- **AND** the URL is replaced with the pathname only, with the query string removed
- **AND** the code is exchanged for tokens

#### Scenario: Mismatched or missing state
- **WHEN** the page loads with a `code` but the `state` is missing or differs from the stored state
- **THEN** the stored state and code verifier are removed
- **AND** no token exchange request is sent
- **AND** the user is not signed in

#### Scenario: State matches but verifier is absent
- **WHEN** the page loads with a `code` and a matching `state`, but no code verifier is stored
- **THEN** no token exchange request is sent

### Requirement: Token exchange endpoint
The system SHALL expose `POST /api/spotify/token`, which exchanges an authorization code and code verifier for tokens using the server-held client credentials.

#### Scenario: Successful exchange
- **WHEN** a JSON request provides `code`, `code_verifier`, and an allowed `redirect_uri`, and Spotify returns tokens
- **THEN** the server posts `grant_type=authorization_code` with those values to `https://accounts.spotify.com/api/token`
- **AND** the response has status 200 with a body containing `access_token`, `expires_in`, and `refresh_token` and no other Spotify fields

#### Scenario: Required parameter missing
- **WHEN** a request omits `code`, `code_verifier`, or `redirect_uri`
- **THEN** the response has status 400 with `{"error": "Missing required parameters: code, code_verifier, redirect_uri"}`
- **AND** Spotify is not contacted

#### Scenario: Spotify rejects the exchange
- **WHEN** Spotify responds with a non-success status to the exchange
- **THEN** the response has the same status code as Spotify's response
- **AND** the body is `{"error": "Token exchange failed"}` with no upstream error detail

#### Scenario: Unexpected failure
- **WHEN** the request to Spotify throws (for example, a network error)
- **THEN** the response has status 500 with `{"error": "Token exchange failed"}`

### Requirement: Redirect URI allowlist
The system SHALL accept a `redirect_uri` on `POST /api/spotify/token` only when it exactly matches an entry in the allowlist, and MUST reject any other value before contacting Spotify.

#### Scenario: Allowlist source
- **WHEN** the server starts
- **THEN** the allowlist is the comma-separated `ALLOWED_REDIRECT_URIS` environment variable with entries trimmed of surrounding whitespace
- **AND** when that variable is unset, the allowlist is `http://localhost:5173/callback,http://localhost:3000/callback`

#### Scenario: Disallowed redirect URI
- **WHEN** a token exchange request supplies a `redirect_uri` that is not in the allowlist
- **THEN** the response has status 400 with `{"error": "Invalid redirect_uri"}`
- **AND** Spotify is not contacted

### Requirement: Token refresh endpoint
The system SHALL expose `POST /api/spotify/refresh`, which requires a JSON body with `refresh_token`. When it is missing, the system MUST respond with status 400 and `{"error": "Missing required parameter: refresh_token"}`. On success, the system SHALL respond with the upstream-issued `access_token`, `expires_in`, and `refresh_token` by posting `grant_type=refresh_token` to the Spotify token endpoint with the server-held client credentials.

#### Scenario: Successful refresh
- **WHEN** a request provides a valid `refresh_token` and Spotify issues a new access token
- **THEN** the response has status 200 with `access_token`, `expires_in`, and `refresh_token`

#### Scenario: Refresh token expired or revoked
- **WHEN** Spotify responds with an `invalid_grant` error to the refresh
- **THEN** the response has the same status code as Spotify's response
- **AND** the body is `{"error": "invalid_grant"}`

#### Scenario: Other refresh failure
- **WHEN** Spotify responds with a non-success status and an error other than `invalid_grant`
- **THEN** the response has the same status code as Spotify's response
- **AND** the body is `{"error": "Token refresh failed"}`

### Requirement: Token endpoint rate limit
The system SHALL limit each client to 20 requests per 15-minute window across both token endpoints, and when the limit is exceeded it SHALL reject the request with the body `{"error": "Too many token requests, please try again later."}`.

#### Scenario: Limit exceeded
- **WHEN** a client sends a 21st token or refresh request within the same 15-minute window
- **THEN** the request is rejected with the rate-limit message
- **AND** Spotify is not contacted

### Requirement: Session storage
The system SHALL keep the access token, refresh token, and expiry timestamp (milliseconds since epoch, computed as the time of receipt plus `expires_in` seconds) in `sessionStorage` under the keys `spotify_access_token`, `spotify_refresh_token`, and `spotify_expires_at`. The system MUST NOT write these values to `localStorage`. When a refresh response omits a refresh token, the system SHALL keep the existing refresh token.

#### Scenario: Tokens received
- **WHEN** tokens are stored after a successful sign-in or refresh
- **THEN** the three values are written to `sessionStorage`

#### Scenario: Refresh response omits refresh token
- **WHEN** a refresh response has no `refresh_token`
- **THEN** the previously stored refresh token is kept

#### Scenario: Page reload in the same tab
- **WHEN** the app loads in a tab whose `sessionStorage` already holds a session
- **THEN** the stored tokens and expiry are restored as the current session

#### Scenario: New tab
- **WHEN** the app loads in a tab with no stored session
- **THEN** the visitor is signed out

### Requirement: Authenticated state
The system SHALL treat the visitor as signed in only while an access token is present and the current time is before the stored expiry timestamp. While signed in, the header SHALL show the Spotify display name, or `User` when no profile is loaded, and offer "Sign out of Spotify". While signed out, the header SHALL offer "Sign in with Spotify", disabled while a sign-in is completing.

#### Scenario: Token expires without refresh
- **WHEN** the expiry timestamp passes and no refresh token is held
- **THEN** the session is cleared
- **AND** the header offers "Sign in with Spotify" again

#### Scenario: Profile lookup fails
- **WHEN** loading the Spotify profile fails with a status other than 401
- **THEN** the lookup is retried once after 1500 ms
- **AND** a 401 response is not retried

### Requirement: Proactive refresh
The system SHALL refresh the access token 5 minutes before its expiry when a refresh token is held. When the refresh window has already passed at the moment the session is loaded or updated, the refresh SHALL start immediately.

#### Scenario: Scheduled refresh
- **WHEN** an access token with a refresh token is within 5 minutes of expiry
- **THEN** a refresh request is sent to `/api/spotify/refresh`
- **AND** the new tokens replace the stored ones on success

### Requirement: Refresh failure ends the session
The system SHALL clear the stored session whenever a refresh request fails, whether from an error response or a network failure. The system MUST NOT retry a refresh that returned `invalid_grant`. When the failure was `invalid_grant`, the system SHALL also set the session-expired state.

#### Scenario: Refresh token invalid
- **WHEN** a refresh returns `invalid_grant`
- **THEN** the access token, refresh token, and expiry are removed from `sessionStorage`
- **AND** the session-expired state is set
- **AND** no retry is attempted

#### Scenario: Refresh fails for another reason
- **WHEN** a refresh fails with an error other than `invalid_grant`, or the request itself fails
- **THEN** the stored session is cleared
- **AND** the session-expired state is not set

### Requirement: Session-expired notice
The system SHALL show a `role="alert"` banner reading "Your Spotify session expired — please sign in again." while the session-expired state is set. The banner SHALL provide a "Sign in" button that starts sign-in (disabled while a sign-in is completing) and a dismiss button labelled "Dismiss notification". The banner MUST be hidden once the user dismisses it or a sign-in completes.

#### Scenario: Banner shown after invalid grant
- **WHEN** the session-expired state is set
- **THEN** the banner is visible with the message and both buttons

#### Scenario: User dismisses the banner
- **WHEN** the user activates the dismiss button
- **THEN** the banner is hidden

#### Scenario: Sign-in completes
- **WHEN** a new sign-in stores tokens
- **THEN** the session-expired state is cleared and the banner is hidden

### Requirement: Sign-out
The system SHALL end the local session when the user activates "Sign out of Spotify". It SHALL remove the access token, refresh token, and expiry from `sessionStorage` and clear the loaded profile. The system SHALL NOT revoke the tokens with Spotify.

#### Scenario: User signs out
- **WHEN** a signed-in user activates "Sign out of Spotify"
- **THEN** the three session keys are removed from `sessionStorage`
- **AND** the header offers "Sign in with Spotify"
