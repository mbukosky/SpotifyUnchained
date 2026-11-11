import { describe, it, expect } from 'vitest';
import { expandTracks } from './useEditions.js';

describe('expandTracks', () => {
  it('derives uri and open_url from the id when the columns are omitted', () => {
    const [track] = expandTracks({ id: ['abc'], name: ['Song'], artist: ['Band'] });
    expect(track.uri).toBe('spotify:track:abc');
    expect(track.open_url).toBe('https://open.spotify.com/track/abc');
  });

  it('uses the stored values when the columns are sent', () => {
    const [track] = expandTracks({
      id: ['abc'], name: ['Song'], artist: ['Band'],
      uri: ['spotify:track:other'], open_url: ['https://open.spotify.com/track/other'],
    });
    expect(track.uri).toBe('spotify:track:other');
    expect(track.open_url).toBe('https://open.spotify.com/track/other');
  });

  it('falls back to the id for a track whose stored open_url is null or empty', () => {
    const tracks = expandTracks({
      id: ['a', 'b', 'c'], name: ['1', '2', '3'], artist: ['x', 'y', 'z'],
      uri: ['spotify:track:other', null, ''],
      open_url: ['https://open.spotify.com/track/other', null, ''],
    });
    expect(tracks[1].open_url).toBe('https://open.spotify.com/track/b');
    expect(tracks[2].open_url).toBe('https://open.spotify.com/track/c');
  });

  it('keeps a null or empty stored uri, so the export can skip it', () => {
    const tracks = expandTracks({
      id: ['a', 'b', 'c'], name: ['1', '2', '3'], artist: ['x', 'y', 'z'],
      uri: ['spotify:track:other', null, ''],
    });
    expect(tracks[1].uri).toBeNull();
    expect(tracks[2].uri).toBe('');
  });
});
