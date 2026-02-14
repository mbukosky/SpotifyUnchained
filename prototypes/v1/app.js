/* ============================================
   SPOTIFY UNCHAINED — NEON TERMINAL APP
   ============================================ */

const MOCK_PLAYLISTS = [
  {
    _id: "1", title: "New.Music.Friday.US.01.31.2025", published_date: "2025-01-31T00:00:00.000Z", region: "US",
    tracks: [
      { _id: "t1", id: "6AI3ezQ4o3HUoP6Dhudph3", name: "luther", artist: "Kendrick Lamar", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/6AI3ezQ4o3HUoP6Dhudph3", uri: "spotify:track:6AI3ezQ4o3HUoP6Dhudph3", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t2", id: "2plbrEY59IikOBgBGLjaoe", name: "Die With A Smile", artist: "Lady Gaga, Bruno Mars", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe", uri: "spotify:track:2plbrEY59IikOBgBGLjaoe", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t3", id: "5vNRhkKd0yEAg8suGBpjeY", name: "APT.", artist: "ROSE, Bruno Mars", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/5vNRhkKd0yEAg8suGBpjeY", uri: "spotify:track:5vNRhkKd0yEAg8suGBpjeY", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t4", id: "7tI8dEa4Oijz1UbTEhEOtQ", name: "BACKGROUND MUSIC", artist: "Metro Boomin", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/7tI8dEa4Oijz1UbTEhEOtQ", uri: "spotify:track:7tI8dEa4Oijz1UbTEhEOtQ", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t5", id: "3yk7PJnryiJ8mAPqsrujzf", name: "Mamushi", artist: "Megan Thee Stallion", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/3yk7PJnryiJ8mAPqsrujzf", uri: "spotify:track:3yk7PJnryiJ8mAPqsrujzf", created: "2025-01-31T00:00:00.000Z" }
    ]
  },
  {
    _id: "2", title: "New.Music.Friday.US.01.24.2025", published_date: "2025-01-24T00:00:00.000Z", region: "US",
    tracks: [
      { _id: "t6", id: "3KkXRkHbMCARz0aVfEt68P", name: "Sprinter", artist: "Dave, Central Cee", added_at: "2025-01-24T00:00:00.000Z", open_url: "https://open.spotify.com/track/3KkXRkHbMCARz0aVfEt68P", uri: "spotify:track:3KkXRkHbMCARz0aVfEt68P", created: "2025-01-24T00:00:00.000Z" },
      { _id: "t7", id: "7x9aauaA9cu6tyfpHnqDLo", name: "Paint The Town Red", artist: "Doja Cat", added_at: "2025-01-24T00:00:00.000Z", open_url: "https://open.spotify.com/track/7x9aauaA9cu6tyfpHnqDLo", uri: "spotify:track:7x9aauaA9cu6tyfpHnqDLo", created: "2025-01-24T00:00:00.000Z" },
      { _id: "t8", id: "0WbMK4wrZ1wFSty9F7FCgu", name: "Cruel Summer", artist: "Taylor Swift", added_at: "2025-01-24T00:00:00.000Z", open_url: "https://open.spotify.com/track/0WbMK4wrZ1wFSty9F7FCgu", uri: "spotify:track:0WbMK4wrZ1wFSty9F7FCgu", created: "2025-01-24T00:00:00.000Z" },
      { _id: "t9", id: "1Qrg8KqiBpW07V7PNxwwwL", name: "Snooze", artist: "SZA", added_at: "2025-01-24T00:00:00.000Z", open_url: "https://open.spotify.com/track/1Qrg8KqiBpW07V7PNxwwwL", uri: "spotify:track:1Qrg8KqiBpW07V7PNxwwwL", created: "2025-01-24T00:00:00.000Z" }
    ]
  },
  {
    _id: "3", title: "New.Music.Friday.UK.01.31.2025", published_date: "2025-01-31T00:00:00.000Z", region: "UK",
    tracks: [
      { _id: "t10", id: "0yLdNVWF3Srea0uzk55zFn", name: "Flowers", artist: "Miley Cyrus", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/0yLdNVWF3Srea0uzk55zFn", uri: "spotify:track:0yLdNVWF3Srea0uzk55zFn", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t11", id: "4Dvkj6JhhA12EX05fT7y2e", name: "As It Was", artist: "Harry Styles", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/4Dvkj6JhhA12EX05fT7y2e", uri: "spotify:track:4Dvkj6JhhA12EX05fT7y2e", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t12", id: "3rUGC1vUpkDG9CZFHMur1t", name: "Unholy", artist: "Sam Smith, Kim Petras", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/3rUGC1vUpkDG9CZFHMur1t", uri: "spotify:track:3rUGC1vUpkDG9CZFHMur1t", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t13", id: "0V3wPSX9ygBnCm8psDIegu", name: "Anti-Hero", artist: "Taylor Swift", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/0V3wPSX9ygBnCm8psDIegu", uri: "spotify:track:0V3wPSX9ygBnCm8psDIegu", created: "2025-01-31T00:00:00.000Z" },
      { _id: "t14", id: "5HCyWlXZPP0y6Gqq8TgA20", name: "Kill Bill", artist: "SZA", added_at: "2025-01-31T00:00:00.000Z", open_url: "https://open.spotify.com/track/5HCyWlXZPP0y6Gqq8TgA20", uri: "spotify:track:5HCyWlXZPP0y6Gqq8TgA20", created: "2025-01-31T00:00:00.000Z" }
    ]
  }
];

/* ---- State ---- */

let selectedRegion = localStorage.getItem('selectedRegion') || 'ALL';
let darkMode = localStorage.getItem('darkMode') !== 'false'; // default true
let expandedPlaylists = new Set();
let activeTrackEmbed = null; // track _id of currently playing embed

/* ---- DOM refs ---- */

const playlistContainer = document.getElementById('playlistContainer');
const terminalStatus = document.getElementById('terminalStatus');
const themeToggle = document.getElementById('themeToggle');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const typewriterEl = document.getElementById('typewriter');

/* ---- Theme ---- */

function applyTheme() {
  if (darkMode) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

themeToggle.addEventListener('click', () => {
  darkMode = !darkMode;
  localStorage.setItem('darkMode', darkMode);
  applyTheme();
});

applyTheme();

/* ---- Mobile menu ---- */

mobileMenuToggle.addEventListener('click', () => {
  const nav = document.querySelector('.header__nav');
  nav.classList.toggle('open');
  mobileMenuToggle.classList.toggle('open');
});

/* ---- Region filters ---- */

function setActiveRegion(region) {
  selectedRegion = region;
  localStorage.setItem('selectedRegion', region);

  document.querySelectorAll('.region-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.region === region);
  });

  renderPlaylists();
  updateStatus();
}

document.querySelectorAll('.region-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveRegion(btn.dataset.region);

    // Close mobile menu after selection
    const nav = document.querySelector('.header__nav');
    if (nav.classList.contains('open')) {
      nav.classList.remove('open');
      mobileMenuToggle.classList.remove('open');
    }
  });
});

/* ---- Typewriter ---- */

function typewriter(el, text, speed = 60) {
  let i = 0;
  el.textContent = '';
  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

/* ---- Status bar ---- */

function updateStatus() {
  const filtered = getFilteredPlaylists();
  const totalTracks = filtered.reduce((sum, p) => sum + p.tracks.length, 0);
  const regionText = selectedRegion === 'ALL' ? 'all regions' : selectedRegion;
  const statusEl = terminalStatus.querySelector('.status-text');
  statusEl.textContent = `found ${filtered.length} playlists (${totalTracks} tracks) // region: ${regionText}`;
}

/* ---- Filtering ---- */

function getFilteredPlaylists() {
  if (selectedRegion === 'ALL') return MOCK_PLAYLISTS;
  return MOCK_PLAYLISTS.filter(p => p.region === selectedRegion);
}

/* ---- Format date ---- */

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---- Render ---- */

function renderPlaylists() {
  const playlists = getFilteredPlaylists();
  playlistContainer.innerHTML = '';

  playlists.forEach((playlist, idx) => {
    const isExpanded = expandedPlaylists.has(playlist._id);
    const card = document.createElement('div');
    card.className = `playlist-card${isExpanded ? ' expanded' : ''}`;
    card.style.animationDelay = `${0.1 + idx * 0.12}s`;

    card.innerHTML = `
      <div class="playlist-header" data-playlist-id="${playlist._id}">
        <div class="playlist-info">
          <div class="playlist-title">
            <span class="title-dollar">$</span>${playlist.title}
          </div>
          <div class="playlist-meta">
            <span class="region-badge">${playlist.region}</span>
            <span>${playlist.tracks.length} tracks</span>
            <span>${formatDate(playlist.published_date)}</span>
          </div>
        </div>
        <div class="playlist-toggle">&#9654;</div>
      </div>
      <div class="tracks-container${isExpanded ? ' open' : ''}">
        <div class="tracks-list">
          ${playlist.tracks.map((track, tIdx) => renderTrack(track, tIdx)).join('')}
        </div>
      </div>
    `;

    playlistContainer.appendChild(card);
  });

  bindPlaylistEvents();
  bindTrackEvents();
}

function renderTrack(track, index) {
  const isActive = activeTrackEmbed === track._id;
  return `
    <div class="track-item" data-track-id="${track._id}">
      <span class="track-index">${String(index + 1).padStart(2, '0')}</span>
      <div class="track-info">
        <span class="track-name">${track.name}</span>
        <span class="track-artist">${track.artist}</span>
      </div>
      <button class="track-play-btn${isActive ? ' active' : ''}" data-track-spotify-id="${track.id}" data-track-id="${track._id}">
        ${isActive ? '[&#9632;]' : '[&#9654;]'}
      </button>
    </div>
    <div class="track-embed${isActive ? ' open' : ''}" data-embed-track-id="${track._id}">
      ${isActive ? buildEmbed(track.id) : ''}
    </div>
  `;
}

function buildEmbed(spotifyId) {
  return `<iframe src="https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator&theme=0" width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

/* ---- Events ---- */

function bindPlaylistEvents() {
  document.querySelectorAll('.playlist-header').forEach(header => {
    header.addEventListener('click', () => {
      const id = header.dataset.playlistId;
      const card = header.closest('.playlist-card');
      const tracksContainer = card.querySelector('.tracks-container');

      if (expandedPlaylists.has(id)) {
        expandedPlaylists.delete(id);
        card.classList.remove('expanded');
        tracksContainer.classList.remove('open');
      } else {
        expandedPlaylists.add(id);
        card.classList.add('expanded');
        tracksContainer.classList.add('open');
      }
    });
  });
}

function bindTrackEvents() {
  document.querySelectorAll('.track-play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = btn.dataset.trackId;
      const spotifyId = btn.dataset.trackSpotifyId;

      if (activeTrackEmbed === trackId) {
        // Close current embed
        activeTrackEmbed = null;
      } else {
        activeTrackEmbed = trackId;
      }

      // Re-render to update embeds
      renderPlaylists();
    });
  });
}

/* ---- Init ---- */

function init() {
  // Restore region
  setActiveRegion(selectedRegion);

  // Start typewriter
  setTimeout(() => {
    typewriter(typewriterEl, 'Archiving the future of music...', 55);
  }, 400);

  // Update status
  updateStatus();

  // Render
  renderPlaylists();
}

document.addEventListener('DOMContentLoaded', init);
