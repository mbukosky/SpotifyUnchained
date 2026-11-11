# Spec Delta

## MODIFIED Requirements

### Requirement: Content security policy
The system SHALL send a Content-Security-Policy header on every response, including static assets, that limits scripts, styles, fonts, images, frames and connections to the source lists in the scenario below.

#### Scenario: Policy source lists
- **WHEN** a client requests any API route or static asset
- **THEN** the Content-Security-Policy header carries `default-src 'self'`
- **AND** `script-src` allows `'self'`, `'unsafe-inline'`, `https://www.googletagmanager.com` and `https://www.google-analytics.com`
- **AND** `style-src` allows `'self'` and `'unsafe-inline'` only
- **AND** `font-src` allows `'self'` only
- **AND** `img-src` allows `'self'`, `data:`, `https://www.google-analytics.com`, `https://i.scdn.co`, `https://*.spotifycdn.com`, `https://cdn.ko-fi.com` and `https://storage.ko-fi.com`
- **AND** `frame-src` allows `https://open.spotify.com`
- **AND** `connect-src` allows `'self'`, `https://accounts.spotify.com`, `https://api.spotify.com` and `https://www.google-analytics.com`

#### Scenario: Policy on a static asset
- **WHEN** the server runs in production and a client requests a file from the built client
- **THEN** the response carries the same Content-Security-Policy header

#### Scenario: Third-party source not listed
- **WHEN** a page attempts to load a script from a host outside the `script-src` list
- **THEN** the browser blocks it under the policy
