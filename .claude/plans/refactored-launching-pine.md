# SpotifyUnchained Redesign — 3 Prototype Mockups

## Context

The current site uses Angular Material with a green/purple theme that feels dated. We need three standalone HTML/CSS/JS prototypes exploring different "clean, futuristic, music-themed, dev-style" directions — none resembling Spotify's branding. These are visual mockups only (no real backend), served by Bun on separate ports for easy side-by-side comparison.

## Prototype Themes

| Version | Theme | Port | Folder |
|---------|-------|------|--------|
| V1 | **Neon Terminal** — Cyberpunk dev console, CRT scanlines, monospace fonts, cyan/magenta neon glows | 4001 | `prototypes/v1/` |
| V2 | **Vinyl Waveform** — Premium studio dashboard, navy/gold, glassmorphism, serif headings, equalizer animations | 4002 | `prototypes/v2/` |
| V3 | **Circuit Board** — Hardware dev aesthetic, charcoal/lime, PCB trace patterns, dot grid, status LEDs | 4003 | `prototypes/v3/` |

## File Structure (per version)

```
prototypes/vN/
├── index.html      # Semantic HTML
├── styles.css      # All styling (CSS variables for dark/light)
├── app.js          # Mock data + interactions
└── serve.js        # Bun static file server (port 400N)
```

## Shared Functional Requirements

All three prototypes include:
- **Region filter** (All / US / UK) — filters playlists, persisted in localStorage
- **Dark/light mode toggle** — persisted in localStorage
- **Expandable playlist list** — click to reveal tracks
- **Track cards** — name, artist, play button that loads Spotify embed iframe
- **Responsive design** — mobile hamburger/collapsed layout at <768px
- **Footer disclaimer** — "Not an official Spotify application"
- **GitHub social link** — links to the repo

## Mock Data

3 playlists (2 US, 1 UK) with 4-6 tracks each, using the same `PlaylistItem` / `TrackItem` shape from `src/app/api-format.ts`. Real Spotify track IDs so embeds work.

## Implementation Approach

### Team: 3 parallel agents (one per version)

Each agent will:
1. Use the `frontend-design` skill with a detailed theme-specific prompt
2. Write `index.html`, `styles.css`, `app.js` with the full mockup
3. Write `serve.js` (Bun static server with MIME types)

### V1 — Neon Terminal Details
- Near-black (#0a0a0f) background with CSS scanline overlay
- `Fira Code` / monospace fonts throughout
- Neon glow borders (cyan #00ffff, magenta #ff00ff)
- Terminal-style UI: `$` prefixes, code-block panels, `[>]` play buttons
- Typewriter animation on header tagline
- Light mode: inverted terminal (white bg, keeps monospace)

### V2 — Vinyl Waveform Details
- Deep navy (#0d1117) with radial gradient
- Google Fonts: `Inter` (body), `Playfair Display` (headings)
- Gold/amber (#d4a853) accents, glassmorphism cards
- Inline SVG waveform decorations, CSS equalizer bar animation
- Circular gold play button morphing into Spotify embed
- Light mode: warm cream (#faf5ef) with navy text

### V3 — Circuit Board Details
- Dark charcoal (#1a1a1a) with dot-grid pattern
- Google Fonts: `IBM Plex Mono` (labels), `IBM Plex Sans` (body)
- Electric lime (#39ff14) primary, teal (#00bcd4) secondary
- PCB trace borders, pin-header decorations on card edges
- Status LEDs, "SYSTEM ONLINE" indicators, version badge
- Light mode: PCB substrate grey (#f0f0eb) with dark traces

### Key Patterns to Reuse
- Spotify embed URL: `https://open.spotify.com/embed/track/{id}?utm_source=generator&theme=0` (from `src/app/track/track.component.ts`)
- localStorage keys: `darkMode`, `selectedRegion` (matching existing app conventions)
- CSS custom properties on `:root` / `[data-theme="light"]` for theme switching

## Verification

1. Start all servers: `cd prototypes/v1 && bun serve.js &` (repeat for v2, v3)
2. Open `localhost:4001`, `localhost:4002`, `localhost:4003`
3. For each, verify:
   - Page loads without console errors
   - Region filter toggles work and persist on reload
   - Dark/light toggle works and persists on reload
   - Playlists expand/collapse to show tracks
   - Play button loads Spotify embed iframe
   - Responsive layout at mobile width
   - Visual theme is distinct and does NOT resemble Spotify branding
