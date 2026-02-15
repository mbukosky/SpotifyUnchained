import Playlist from '../models/playlist.js';
import { escapeXml, buildFeed } from '../lib/rss.js';
import { VALID_REGIONS } from '../lib/regions.js';
const SITE_URL = 'https://spotifyunchained.com';

export async function feed(req, res) {
  try {
    const filter = {};
    if (req.query.region && VALID_REGIONS.includes(req.query.region)) {
      filter.region = req.query.region;
    }

    const playlists = await Playlist.find(filter)
      .sort({ published_date: -1 })
      .limit(50)
      .lean();

    const regionLabel = filter.region || 'All Regions';
    const title = `Spotify Unchained — New Music Friday (${regionLabel})`;
    const description = `Weekly archive of Spotify's New Music Friday playlist (${regionLabel})`;

    const items = playlists.map((playlist) => {
      const trackList = playlist.tracks
        .map(
          (t) =>
            `<li><a href="${escapeXml(t.open_url)}">${escapeXml(t.name)} &mdash; ${escapeXml(t.artist)}</a></li>`,
        )
        .join('');

      return {
        title: playlist.title,
        link: SITE_URL,
        guid: `${SITE_URL}/playlist/${playlist._id}`,
        pubDate: new Date(playlist.published_date).toUTCString(),
        description: `<ul>${trackList}</ul>`,
      };
    });

    const xml = buildFeed({ title, link: SITE_URL, description, items });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('Error generating RSS feed:', err);
    res.status(500).set('Content-Type', 'text/plain').send('Internal server error');
  }
}
