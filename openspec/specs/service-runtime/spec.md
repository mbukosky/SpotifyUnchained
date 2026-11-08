# service-runtime Specification

## Purpose
This capability covers how the SpotifyUnchained server starts, what configuration it requires, and how it protects itself and reports health. It defines the security headers and CSP, CORS scope, rate limits, body size limit, production client serving and SPA fallback, and the shape of error and health responses.

## Requirements
### Requirement: Required configuration fails fast
The system SHALL refuse to start when any of `DB_URI`, `SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_SECRET` is unset or empty, and SHALL name every missing variable in the startup error.

#### Scenario: Missing required variables
- **WHEN** the server starts with `DB_URI` and `SPOTIFY_CLIENT_SECRET` unset
- **THEN** startup fails with an error reading `Missing required environment variables: DB_URI, SPOTIFY_CLIENT_SECRET`
- **AND** the server does not listen on any port

#### Scenario: All required variables present
- **WHEN** all three required variables are non-empty
- **THEN** configuration loads without error

### Requirement: Optional configuration defaults
The system SHALL default `PORT` to `3000`, `NODE_ENV` to `development`, and `ALLOWED_ORIGINS` to `http://localhost:5173,http://localhost:3000`.

#### Scenario: Defaults applied
- **WHEN** `PORT`, `NODE_ENV` and `ALLOWED_ORIGINS` are unset
- **THEN** the server listens on port 3000 in development mode
- **AND** CORS allows `http://localhost:5173` and `http://localhost:3000`

### Requirement: Database connection precedes listening
The system SHALL connect to MongoDB before it begins accepting HTTP connections, and SHALL exit with status code 1 if that connection fails.

#### Scenario: Database reachable
- **WHEN** the server starts and the MongoDB connection succeeds
- **THEN** it logs `MongoDB connected` and then starts listening on the configured port

#### Scenario: Database unreachable
- **WHEN** the server starts and the MongoDB connection fails
- **THEN** it logs a connection error and exits with status code 1
- **AND** it does not listen on the configured port

### Requirement: Health check reports database readiness
The system SHALL expose `GET /health`, which SHALL respond `200` with `{"status":"ok"}` only when the database answers a ping. Otherwise it SHALL respond `503` with `{"status":"unavailable"}`. Every `/health` response SHALL carry `Cache-Control: no-store`. A ping that does not complete within 5000 ms SHALL count as a failure.

#### Scenario: Database answers
- **WHEN** a client requests `/health` and the database answers a ping
- **THEN** the response status is `200` with body `{"status":"ok"}`
- **AND** the response carries `Cache-Control: no-store`

#### Scenario: Database not connected
- **WHEN** a client requests `/health` and the database connection is not in the connected state
- **THEN** the response status is `503` with body `{"status":"unavailable"}`
- **AND** no ping is sent

#### Scenario: Ping fails or hangs
- **WHEN** a client requests `/health` and the ping errors or does not complete within 5000 ms
- **THEN** the response status is `503` with body `{"status":"unavailable"}`

#### Scenario: Health endpoint rate limited
- **WHEN** a single client sends more than 30 requests to `/health` within 60 seconds
- **THEN** further requests in that window are refused with body `{"status":"rate_limited"}`
- **AND** the response includes standard rate-limit headers

### Requirement: Content security policy
The system SHALL send a Content-Security-Policy header on every response, including static assets, that limits scripts, styles, fonts, images, frames and connections to the source lists in the scenario below.

#### Scenario: Policy source lists
- **WHEN** a client requests any API route or static asset
- **THEN** the Content-Security-Policy header carries `default-src 'self'`
- **AND** `script-src` allows `'self'`, `'unsafe-inline'`, `https://www.googletagmanager.com` and `https://www.google-analytics.com`
- **AND** `style-src` allows `'self'`, `'unsafe-inline'` and `https://fonts.googleapis.com`
- **AND** `font-src` allows `'self'` and `https://fonts.gstatic.com`
- **AND** `img-src` allows `'self'`, `data:`, `https://www.google-analytics.com`, `https://i.scdn.co`, `https://cdn.ko-fi.com` and `https://storage.ko-fi.com`
- **AND** `frame-src` allows `https://open.spotify.com`
- **AND** `connect-src` allows `'self'`, `https://accounts.spotify.com`, `https://api.spotify.com` and `https://www.google-analytics.com`

#### Scenario: Policy on a static asset
- **WHEN** the server runs in production and a client requests a file from the built client
- **THEN** the response carries the same Content-Security-Policy header

#### Scenario: Third-party source not listed
- **WHEN** a page attempts to load a script from a host outside the `script-src` list
- **THEN** the browser blocks it under the policy

### Requirement: Transport and referrer headers
The system SHALL send a `Strict-Transport-Security` header with value `max-age=31536000; includeSubDomains` and a `Referrer-Policy` header with value `strict-origin-when-cross-origin` on every response.

#### Scenario: Headers on an API response
- **WHEN** a client requests any API route
- **THEN** the response carries `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **AND** the response carries `Referrer-Policy: strict-origin-when-cross-origin`

### Requirement: CORS scope and origin allow-list
The system SHALL apply CORS only to paths under `/api`, `/spotify` and `/rss`. For those paths it SHALL allow a request whose `Origin` header is absent or matches an entry in `ALLOWED_ORIGINS`. Other paths SHALL NOT receive CORS headers.

#### Scenario: Configured origin on an API path
- **WHEN** a preflight request to `/api/spotify/token` carries `Origin: http://localhost:3000`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:3000`

#### Scenario: Request without an Origin header
- **WHEN** a server-to-server or command-line request has no `Origin` header
- **THEN** the request is processed without any origin check

#### Scenario: Non-API path with a foreign origin
- **WHEN** a request to `/wp-admin/setup.php` carries `Origin: https://evil.example.com`
- **THEN** the response is the JSON 404 and carries no CORS headers

### Requirement: Unknown origins are denied quietly
The system SHALL deny an API request from an origin not on the allow-list by omitting CORS headers, and SHALL NOT turn that denial into a server error. The system SHALL log a warning for a given unknown origin at most once, and SHALL stop recording new unknown origins after 100 distinct ones.

#### Scenario: Unknown origin preflight
- **WHEN** a preflight request to `/api/spotify/token` carries `Origin: https://evil.example.com`
- **THEN** the response has no `Access-Control-Allow-Origin` header
- **AND** the response status is below 500

#### Scenario: Repeated unknown origin
- **WHEN** the same unknown origin sends two requests to an API path
- **THEN** a single rejection warning is logged for that origin

### Requirement: JSON request body limit
The system SHALL parse JSON request bodies only up to 10 kilobytes, and SHALL reject larger JSON bodies before they reach route handlers.

#### Scenario: Oversized JSON body
- **WHEN** a client posts a JSON body larger than 10kb to an API route
- **THEN** the request is rejected before any route handler runs
- **AND** the response is the generic error body described in the error requirement

### Requirement: API rate limiting
The system SHALL allow at most 100 requests per client within any 15-minute window to paths under `/api/`. Requests beyond that limit SHALL be refused with body `{"error":"Too many requests, please try again later."}`. Responses SHALL include standard `RateLimit` headers and no legacy `X-RateLimit` headers.

#### Scenario: Request over the limit
- **WHEN** a single client sends its 101st request to `/api/` within a 15-minute window
- **THEN** the request is refused with status 429 and body `{"error":"Too many requests, please try again later."}`

#### Scenario: Standard headers only
- **WHEN** a client receives any response from an `/api/` path
- **THEN** the response carries standard `RateLimit` headers
- **AND** it carries no `X-RateLimit` headers

### Requirement: Client address for rate limiting
The system SHALL trust exactly one proxy hop when `NODE_ENV` is `production`, so the client address used for rate limiting is the one supplied by the edge proxy. Outside production it SHALL NOT trust forwarded address headers.

#### Scenario: Production behind the edge proxy
- **WHEN** the server runs with `NODE_ENV=production` and a request arrives with an `X-Forwarded-For` header
- **THEN** the rate limiter keys on the address the proxy supplied, not the proxy's own address

#### Scenario: Development forwarded header
- **WHEN** the server runs outside production and a request carries an `X-Forwarded-For` header
- **THEN** the forwarded address is ignored for rate limiting

### Requirement: Production client serving and SPA fallback
The system SHALL, only when `NODE_ENV` is `production`, serve the built client from `client/dist` before any CORS handling. For a GET request that matches no route and no static file, the system SHALL return `index.html` unless the request path has a file extension, in which case it SHALL fall through to the JSON 404. API and other routes SHALL take precedence over the fallback.

#### Scenario: Client route in production
- **WHEN** the server runs in production and a client requests `/some/client/route` with no file extension
- **THEN** the response is the built `index.html`

#### Scenario: Missing file in production
- **WHEN** the server runs in production and a client requests `/missing.js`
- **THEN** the response is the JSON 404 `{"error":"Not found"}`

#### Scenario: Outside production
- **WHEN** the server runs outside production and a client requests a non-API path
- **THEN** no client shell is served and the response is the JSON 404 `{"error":"Not found"}`

### Requirement: JSON 404 for unmatched routes
The system SHALL answer any request that no route handles with status `404` and body `{"error":"Not found"}`.

#### Scenario: Unknown route
- **WHEN** a client sends a POST to `/definitely/not/a/route`
- **THEN** the response is status 404 with body `{"error":"Not found"}`

### Requirement: Sanitized error responses
The system SHALL answer any unhandled error with body `{"error":"Internal server error"}`, using the error's `status` property when present and `500` otherwise. The system SHALL log the failing method, URL and message, and SHALL include the stack trace in the log only outside production. Upstream error details SHALL NOT appear in responses.

#### Scenario: Unhandled server error
- **WHEN** a route throws an error with no status property
- **THEN** the response is status 500 with body `{"error":"Internal server error"}`
- **AND** the failure is logged with method and URL

#### Scenario: Error with a status
- **WHEN** a route raises an error whose `status` is 400
- **THEN** the response status is 400 with body `{"error":"Internal server error"}`

#### Scenario: Stack trace visibility
- **WHEN** an error is handled in production
- **THEN** the stack trace is not written to the log
