import { describe, it, expect, vi } from 'vitest';
import {
  parseCumulativeMarkdown,
  reconstructPlaylist,
  generateFridays,
  formatTitle,
} from './backfill.js';

describe('parseCumulativeMarkdown', () => {
  const header = '| Title | Artist(s) | Album | Length | Added | Removed |\n|---|---|---|---|---|---|\n';

  it('parses a basic track row', () => {
    const md =
      header +
      '| [Song Name](https://open.spotify.com/track/abc123) | [Artist One](https://open.spotify.com/artist/xyz) | [Album](https://open.spotify.com/album/alb1) | 3:30 | 2024-01-05 | 2024-01-12 |\n';
    const tracks = parseCumulativeMarkdown(md);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toEqual({
      id: 'abc123',
      name: 'Song Name',
      artist: 'Artist One',
      open_url: 'https://open.spotify.com/track/abc123',
      uri: 'spotify:track:abc123',
      added: new Date('2024-01-05T00:00:00Z'),
      removed: new Date('2024-01-12T00:00:00Z'),
    });
  });

  it('handles escaped characters in names', () => {
    const md =
      header +
      '| [Mr\\. Smith \\(Remix\\)](https://open.spotify.com/track/def456) | [Dr\\. Dre](https://open.spotify.com/artist/dre1) | [Album](https://open.spotify.com/album/a) | 4:00 | 2024-02-01 |  |\n';
    const tracks = parseCumulativeMarkdown(md);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Mr. Smith (Remix)');
    expect(tracks[0].artist).toBe('Dr. Dre');
  });

  it('extracts only the first artist when multiple are listed', () => {
    const md =
      header +
      '| [Collab](https://open.spotify.com/track/col1) | [First](https://open.spotify.com/artist/a1), [Second](https://open.spotify.com/artist/a2) | [Album](https://open.spotify.com/album/a) | 3:00 | 2024-03-01 |  |\n';
    const tracks = parseCumulativeMarkdown(md);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].artist).toBe('First');
  });

  it('handles empty Removed date', () => {
    const md =
      header +
      '| [Current](https://open.spotify.com/track/cur1) | [Artist](https://open.spotify.com/artist/a1) | [Album](https://open.spotify.com/album/a) | 3:00 | 2024-06-01 |  |\n';
    const tracks = parseCumulativeMarkdown(md);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].removed).toBeNull();
  });

  it('skips rows with empty track names', () => {
    const md =
      header +
      '| [](https://open.spotify.com/track/empty1) | [Artist](https://open.spotify.com/artist/a1) | [Album](https://open.spotify.com/album/a) | 0:00 | 2024-01-01 | 2024-01-08 |\n';
    const tracks = parseCumulativeMarkdown(md);
    expect(tracks).toHaveLength(0);
  });

  it('skips malformed rows', () => {
    const md = header + '| not a valid row |\n| also bad |\n';
    const tracks = parseCumulativeMarkdown(md);
    expect(tracks).toHaveLength(0);
  });
});

describe('reconstructPlaylist', () => {
  const tracks = [
    { id: '1', name: 'A', artist: 'X', open_url: '', uri: '', added: new Date('2024-01-05T00:00:00Z'), removed: new Date('2024-01-12T00:00:00Z') },
    { id: '2', name: 'B', artist: 'Y', open_url: '', uri: '', added: new Date('2024-01-05T00:00:00Z'), removed: null },
    { id: '3', name: 'C', artist: 'Z', open_url: '', uri: '', added: new Date('2024-01-12T00:00:00Z'), removed: null },
  ];

  it('includes tracks added on or before the friday with no removal', () => {
    const result = reconstructPlaylist(tracks, new Date('2024-01-05T00:00:00Z'));
    const ids = result.map((t) => t.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).not.toContain('3');
  });

  it('excludes tracks removed on or before the friday', () => {
    const result = reconstructPlaylist(tracks, new Date('2024-01-12T00:00:00Z'));
    const ids = result.map((t) => t.id);
    expect(ids).not.toContain('1'); // removed on this date
    expect(ids).toContain('2');
    expect(ids).toContain('3');
  });

  it('returns empty array when no tracks match', () => {
    const result = reconstructPlaylist(tracks, new Date('2024-01-01T00:00:00Z'));
    expect(result).toHaveLength(0);
  });
});

describe('generateFridays', () => {
  it('returns the correct number of fridays', () => {
    const fridays = generateFridays(10);
    expect(fridays).toHaveLength(10);
  });

  it('all dates are Fridays', () => {
    const fridays = generateFridays(10);
    for (const f of fridays) {
      expect(f.getDay()).toBe(5);
    }
  });

  it('each friday is 7 days apart', () => {
    const fridays = generateFridays(5);
    for (let i = 1; i < fridays.length; i++) {
      const diff = fridays[i - 1].getTime() - fridays[i].getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });
});

describe('formatTitle', () => {
  it('formats title matching sync.js convention', () => {
    const friday = new Date(2024, 0, 5); // Jan 5, 2024 (local)
    const title = formatTitle('CA', friday);
    expect(title).toBe('New.Music.Friday.CA.01.05.2024');
  });

  it('pads single-digit month and day', () => {
    const friday = new Date(2024, 2, 1); // Mar 1, 2024
    const title = formatTitle('DE', friday);
    expect(title).toBe('New.Music.Friday.DE.03.01.2024');
  });
});
