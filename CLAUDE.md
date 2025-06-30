# SpotifyUnchained - Development Guide

## Project Overview

SpotifyUnchained is a web application that automatically archives Spotify's "New Music Friday" playlists before they refresh weekly. This ensures music lovers never lose track of previously featured songs. The application consists of an Angular frontend and a Node.js/Express backend with MongoDB for data persistence.

**Key Features:**
- Automatically archives Spotify's New Music Friday playlist
- Web interface to browse historical playlist archives
- Material Design UI with dark/light theme support
- RESTful API for playlist data
- Scheduled playlist synchronization

## Architecture

### Tech Stack
- **Frontend**: Angular 14 with Angular Material
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Build Tools**: Angular CLI with custom Webpack configuration
- **Testing**: Jasmine, Karma, Protractor (E2E)
- **Linting**: ESLint + TSLint for TypeScript, JSHint for Node.js
- **Deployment**: Heroku-ready with Procfile

### Project Structure
```
├── src/app/                    # Angular application source
│   ├── components/             # Angular components
│   ├── services/              # Angular services
│   └── environments/          # Environment configurations
├── app/                       # Express.js backend
│   ├── controllers/           # Route handlers
│   ├── models/               # Mongoose schemas
│   └── routes/               # API route definitions
├── config/                    # Server configuration
│   ├── env/                  # Environment-specific configs
│   └── express.js            # Express app setup
└── dist/                     # Built Angular app (production)
```

## Development Setup

### Prerequisites
- Node.js 18.x
- npm 9.8.x
- MongoDB (running on default port 27017)
- Angular CLI: `npm install -g @angular/cli`

### Environment Variables
Create environment-specific configuration files or set these variables:

**Required for Spotify Integration:**
- `SPOTIFY_CLIENT_ID` - Your Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Your Spotify app client secret

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test/secure)
- `SESSION_SECRET` - Express session secret
- `MAILER_*` - Email configuration variables

### Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start MongoDB:**
   ```bash
   ./mongod --dbpath ~/data/db/
   ```

3. **Development Mode:**
   
   **Terminal 1 - Start Express API server:**
   ```bash
   npm start  # Runs on port 3000
   ```
   
   **Terminal 2 - Start Angular dev server:**
   ```bash
   ng serve  # Runs on port 4200 with proxy to API
   ```
   
   Access application at: http://localhost:4200

4. **Production Mode:**
   ```bash
   npm run build        # Build Angular app
   npm start           # Start Express server (serves built app)
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Express server |
| `npm run build` | Build Angular app for production |
| `npm test` | Run Angular unit tests |
| `npm run test-headless` | Run tests in headless Chrome |
| `npm run lint` | Lint both backend (JSHint) and frontend (ESLint) |
| `npm run e2e` | Run end-to-end tests |
| `ng serve` | Start Angular dev server with proxy |
| `ng build --configuration production` | Production build |

## API Endpoints

### Playlist API
- `GET /spotify` - List archived playlists
  - Query params: `page`, `size`, `sort` (asc/desc)
  - Returns paginated playlist data with track information

## Database Schema

### Playlist Model
```javascript
{
  title: String,                    // e.g., "New.Music.Friday.12.08.2023"
  published_date: Date,             // Auto-generated from title
  tracks: [
    {
      id: String,                   // Spotify track ID
      name: String,                 // Track name
      artist: String,               // Primary artist
      added_at: Date,               // When added to playlist
      open_url: String,             // Spotify web URL
      uri: String,                  // Spotify URI
      created: Date                 // Document creation time
    }
  ]
}
```

## Configuration Files

### Angular Configuration
- **angular.json** - Angular CLI configuration with custom webpack
- **tsconfig.json** - TypeScript compiler options
- **proxy.conf.json** - Development proxy config (routes /spotify to backend)
- **custom-webpack.config.js** - Injects environment variables into build

### Backend Configuration
- **config/config.js** - Main configuration loader
- **config/env/** - Environment-specific settings
  - `all.js` - Base configuration
  - `development.js` - Local development
  - `production.js` - Production settings
  - `secure.js` - HTTPS configuration

### Linting & Testing
- **.eslintrc.json** - ESLint configuration for Angular
- **tslint.json** - TSLint rules (legacy, being phased out)
- **karma.conf.js** - Karma test runner configuration
- **e2e/protractor.conf.js** - End-to-end test configuration

## Key Components

### Frontend (Angular)
- **PlaylistTableComponent** - Main data table with pagination/sorting
- **PlaylistComponent** - Individual playlist display
- **TrackComponent** - Individual track display
- **ToolbarComponent** - Navigation and controls
- **ThemeService** - Dark/light mode management
- **PlaylistService** - HTTP client for API communication

### Backend (Express)
- **playlist.server.controller.js** - Playlist CRUD operations
- **spotify.server.controller.js** - Spotify API integration
- **playlist.server.model.js** - Mongoose schema definition

## Build & Deployment

### Development Build
Angular development server automatically proxies API calls to Express server via `proxy.conf.json`.

### Production Build
1. `ng build --configuration production` creates optimized bundle in `dist/`
2. Express server serves static files from `dist/SpotifyUnchained/`
3. Environment variables injected via custom webpack configuration

### Heroku Deployment
- **Procfile** - Defines web process: `./node_modules/.bin/forever -m 5 server.js`
- Configure environment variables in Heroku dashboard
- MongoDB via add-on (e.g., MongoDB Atlas)

## Spotify Integration

### Authentication
Uses Spotify Client Credentials flow for server-to-server access (no user login required).

### Playlist Synchronization
- **Manual**: Run `node spotify-loader.js` to sync playlists from `spotify-playlist.json`
- **Automatic**: Scheduler can be implemented using `node-schedule` package
- **Current Target**: New Music Friday playlist ID: `37i9dQZF1DX4JAvHpjipBk`

## Testing

### Unit Tests
```bash
npm test                    # Interactive mode
npm run test-headless      # CI mode
```

### E2E Tests
```bash
npm run e2e
```

### Linting
```bash
npm run lint               # Runs JSHint (backend) + ESLint (frontend)
```

## Common Development Tasks

### Adding New Environment Variables
1. Add to `custom-webpack.config.js` for frontend access
2. Add to appropriate `config/env/*.js` file for backend
3. Update this documentation

### Database Operations
- Connect to local MongoDB: `mongodb://localhost/spotifyunchained-dev`
- View data: Use MongoDB Compass or CLI
- Reset database: Drop `spotifyunchained-dev` database

### Debugging
- Backend: Use Node.js debugger or console.log
- Frontend: Use Angular DevTools browser extension
- Network: Check proxy configuration in `proxy.conf.json`

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000 (API) and 4200 (Angular) are available
2. **MongoDB connection**: Verify MongoDB is running and accessible
3. **Proxy errors**: Check `proxy.conf.json` configuration
4. **Build errors**: Clear `node_modules` and reinstall dependencies
5. **Spotify API**: Verify client credentials are set correctly

### Logs
- Express server logs to console
- Angular dev server shows compilation status
- Network requests visible in browser DevTools

---

*This guide covers the essential information for developing and maintaining the SpotifyUnchained application. For additional details, refer to the source code and official documentation for the respective technologies.*