// ============================================
// SpotifyUnchained — Vinyl Waveform / Premium Studio
// Vanilla JS — Mock Data, DOM, Events, Persistence
// ============================================

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

// ---- State ----
let selectedRegion = localStorage.getItem("selectedRegion") || "ALL";
let darkMode = localStorage.getItem("darkMode") !== "false"; // default true
let activeEmbed = null; // track ID of currently playing embed

// ---- DOM References ----
const playlistContainer = document.getElementById("playlistContainer");
const regionButtons = document.querySelectorAll(".region-btn");
const themeToggle = document.getElementById("themeToggle");

// ---- Helpers ----
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function generateWaveformSVG() {
  const bars = 30;
  let paths = "";
  for (let i = 0; i < bars; i++) {
    const x = (i / bars) * 120;
    const h = 4 + Math.random() * 22;
    const y = 15 - h / 2;
    paths += `<rect x="${x}" y="${y}" width="2.5" height="${h}" rx="1.25" fill="var(--gold)" opacity="0.5"/>`;
  }
  return `<svg class="playlist-waveform" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
}

// ---- Render ----
function renderPlaylists() {
  const filtered = selectedRegion === "ALL"
    ? MOCK_PLAYLISTS
    : MOCK_PLAYLISTS.filter(p => p.region === selectedRegion);

  if (filtered.length === 0) {
    playlistContainer.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <p style="font-family:var(--font-display);font-size:1.2rem;margin-bottom:8px">No playlists found</p>
        <p style="font-size:0.85rem">Try selecting a different region filter.</p>
      </div>`;
    return;
  }

  playlistContainer.innerHTML = filtered.map((playlist, idx) => `
    <article class="playlist-card" data-id="${playlist._id}">
      <div class="playlist-header" role="button" tabindex="0" aria-expanded="false" aria-label="Toggle ${playlist.title}">
        <svg class="playlist-vinyl-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <circle cx="22" cy="22" r="20" stroke="var(--gold)" stroke-width="1" opacity="0.5"/>
          <circle cx="22" cy="22" r="14" stroke="var(--gold)" stroke-width="0.5" opacity="0.3"/>
          <circle cx="22" cy="22" r="8" stroke="var(--gold)" stroke-width="0.5" opacity="0.3"/>
          <circle cx="22" cy="22" r="3" fill="var(--gold)" opacity="0.6"/>
          <circle cx="22" cy="22" r="1" fill="var(--bg-primary)"/>
        </svg>
        <div class="playlist-info">
          <h3 class="playlist-title">${playlist.title.replace(/\./g, " . ")}</h3>
          <div class="playlist-meta">
            <span class="region-badge">${playlist.region}</span>
            <span>${formatDate(playlist.published_date)}</span>
            <span>${playlist.tracks.length} tracks</span>
          </div>
        </div>
        ${generateWaveformSVG()}
        <svg class="playlist-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M5 7.5 L10 12.5 L15 7.5"/>
        </svg>
      </div>
      <div class="track-list">
        <div class="track-list-inner">
          ${playlist.tracks.map((track, i) => `
            <div class="track-item" data-track-id="${track.id}">
              <span class="track-number">${String(i + 1).padStart(2, "0")}</span>
              <button class="track-play-btn ${activeEmbed === track.id ? "active" : ""}" data-track-id="${track.id}" aria-label="Play ${track.name}">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  ${activeEmbed === track.id
                    ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
                    : '<polygon points="6,4 20,12 6,20"/>'}
                </svg>
              </button>
              <div class="track-details">
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artist}</div>
              </div>
              <a href="${track.open_url}" target="_blank" rel="noopener noreferrer" class="track-open-link" aria-label="Open ${track.name} on Spotify">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
            <div class="track-embed-container ${activeEmbed === track.id ? "active" : ""}" data-embed-for="${track.id}">
              ${activeEmbed === track.id
                ? `<iframe src="https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0" width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`
                : ""}
            </div>
          `).join("")}
        </div>
      </div>
    </article>
  `).join("");

  bindPlaylistEvents();
}

// ---- Event Binding ----
function bindPlaylistEvents() {
  // Playlist expand/collapse
  document.querySelectorAll(".playlist-header").forEach(header => {
    header.addEventListener("click", () => {
      const card = header.closest(".playlist-card");
      const isExpanded = card.classList.contains("expanded");
      card.classList.toggle("expanded");
      header.setAttribute("aria-expanded", !isExpanded);
    });

    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        header.click();
      }
    });
  });

  // Track play buttons
  document.querySelectorAll(".track-play-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const trackId = btn.dataset.trackId;

      if (activeEmbed === trackId) {
        // Toggle off
        activeEmbed = null;
      } else {
        activeEmbed = trackId;
      }

      // Re-render to update embed states
      renderPlaylists();

      // Re-expand the parent card
      if (activeEmbed) {
        const embedEl = document.querySelector(`[data-embed-for="${activeEmbed}"]`);
        if (embedEl) {
          const card = embedEl.closest(".playlist-card");
          if (card && !card.classList.contains("expanded")) {
            card.classList.add("expanded");
            card.querySelector(".playlist-header").setAttribute("aria-expanded", "true");
          }
        }
      }
    });
  });
}

// ---- Region Filter ----
regionButtons.forEach(btn => {
  // Set initial active state
  if (btn.dataset.region === selectedRegion) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }

  btn.addEventListener("click", () => {
    selectedRegion = btn.dataset.region;
    localStorage.setItem("selectedRegion", selectedRegion);
    regionButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeEmbed = null;
    renderPlaylists();
  });
});

// ---- Theme Toggle ----
function applyTheme() {
  if (darkMode) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
  }
}

themeToggle.addEventListener("click", () => {
  darkMode = !darkMode;
  localStorage.setItem("darkMode", darkMode);
  applyTheme();
});

// ---- Init ----
applyTheme();
renderPlaylists();
