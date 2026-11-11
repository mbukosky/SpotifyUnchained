import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
// Not server/lib/sync.js: that module validates the server's env at import time
// and wires up cron, and this script must report a missing variable by name.
import { chooseCover } from '../server/lib/cover.js';

const BATCH_SIZE = 50;
const LOG_EVERY_BATCHES = 20;
const REQUIRED_ENV = ['DB_URI', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getClientToken(fetchFn, env) {
  const response = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.SPOTIFY_CLIENT_ID,
      client_secret: env.SPOTIFY_CLIENT_SECRET,
    }),
  });
  if (!response.ok) throw new Error(`Failed to get client token: ${response.status}`);
  return (await response.json()).access_token;
}

/**
 * Archived tracks with no cover, from every playlist. `missing` maps each
 * distinct track id to the `_id`s of the playlists holding it without a cover.
 */
export async function findMissingCovers(collection) {
  const playlists = await collection
    .find({}, { projection: { 'tracks.id': 1, 'tracks.cover': 1 } })
    .toArray();
  const missing = new Map();
  for (const playlist of playlists) {
    for (const track of playlist.tracks || []) {
      if (!track.id || track.cover) continue;
      if (!missing.has(track.id)) missing.set(track.id, new Map());
      missing.get(track.id).set(String(playlist._id), playlist._id);
    }
  }
  return missing;
}

/**
 * GET one batch of tracks. 429 waits for Retry-After and repeats the same
 * request; 401 gets a new token once and repeats; anything else non-2xx throws.
 */
export async function fetchBatch(ids, auth, { fetchFn, getToken, sleepFn, log = () => {} }) {
  const url = `https://api.spotify.com/v1/tracks?ids=${ids.join(',')}`;
  let refreshed = false;

  for (;;) {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${auth.token}` } });

    if (response.ok) return (await response.json()).tracks || [];

    if (response.status === 429) {
      const seconds = Number(response.headers?.get?.('Retry-After'));
      const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 1;
      log(`  Spotify answered 429; waiting ${wait} s`);
      await sleepFn(wait * 1000);
      continue;
    }
    if (response.status === 401 && !refreshed) {
      refreshed = true;
      auth.token = await getToken();
      continue;
    }
    throw new Error(`Spotify lookup failed: ${response.status}`);
  }
}

// The only write the script makes: sets `cover` on the elements of `tracks`
// with this id that have none. Nothing else in the document can change.
// Naming the playlists lets Mongo find them by `_id` instead of scanning the
// whole archive once per track.
export function coverUpdate(id, url, playlistIds) {
  return [
    { _id: { $in: playlistIds }, 'tracks.id': id },
    { $set: { 'tracks.$[t].cover': url } },
    { arrayFilters: [{ 't.id': id, 't.cover': { $in: [null, ''] } }] },
  ];
}

export async function backfillCovers({
  collection,
  fetchFn = fetch,
  env = process.env,
  dryRun = false,
  sleepFn = sleep,
  log = console.log,
}) {
  const missing = await findMissingCovers(collection);
  const ids = [...missing.keys()];
  log(`${ids.length} distinct tracks without a cover${dryRun ? ' (dry run, nothing will be written)' : ''}`);

  const getToken = () => getClientToken(fetchFn, env);
  const auth = { token: ids.length > 0 ? await getToken() : null };
  const summary = { looked: 0, found: 0, notFound: 0, playlists: 0, tracks: 0 };
  const touched = new Set();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await fetchBatch(batch, auth, { fetchFn, getToken, sleepFn, log });

    // Spotify answers in request order, with null for a track it no longer has.
    const writes = [];
    for (let j = 0; j < batch.length; j++) {
      const id = batch[j];
      const cover = chooseCover(results[j]);
      summary.looked++;
      if (!cover) {
        summary.notFound++;
        continue;
      }
      summary.found++;
      summary.tracks += missing.get(id).size;
      for (const playlistId of missing.get(id).keys()) touched.add(playlistId);
      if (!dryRun) writes.push(collection.updateMany(...coverUpdate(id, cover, [...missing.get(id).values()])));
    }
    // A batch's writes touch different tracks, so they can go out together.
    await Promise.all(writes);

    const batchNumber = i / BATCH_SIZE + 1;
    if (batchNumber % LOG_EVERY_BATCHES === 0) {
      log(`  ${summary.looked}/${ids.length} looked up, ${summary.found} covers found`);
    }
  }

  summary.playlists = touched.size;
  const verb = dryRun ? 'would be updated' : 'updated';
  log(`Tracks looked up: ${summary.looked}`);
  log(`Covers found: ${summary.found}`);
  log(`Left without a cover: ${summary.notFound}`);
  log(`Playlists ${verb}: ${summary.playlists}`);
  log(`Tracks ${verb}: ${summary.tracks}`);
  return summary;
}

async function main() {
  const missingVars = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.DB_URI);
  try {
    await backfillCovers({
      collection: mongoose.connection.collection('playlists'),
      dryRun: process.argv.includes('--dry-run'),
    });
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Cover backfill failed:', err.message);
    process.exit(1);
  });
}
