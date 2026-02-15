import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/playlist.js', () => {
  const mockLean = vi.fn();
  const mockLimit = vi.fn(() => ({ lean: mockLean }));
  const mockSort = vi.fn(() => ({ limit: mockLimit }));
  const mockFind = vi.fn(() => ({ sort: mockSort }));

  return {
    default: {
      find: mockFind,
      _mocks: { mockFind, mockSort, mockLimit, mockLean },
    },
  };
});

import { feed } from './rss.js';
import Playlist from '../models/playlist.js';

const { mockFind, mockSort, mockLimit, mockLean } = Playlist._mocks;

function mockReqRes(query = {}) {
  const req = { query };
  const res = {
    send: vi.fn(),
    set: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

const SAMPLE_PLAYLIST = {
  _id: '507f1f77bcf86cd799439011',
  title: 'New.Music.Friday.US.02.14.2026',
  region: 'US',
  published_date: new Date('2026-02-14'),
  tracks: [
    {
      name: 'Test Track',
      artist: 'Test Artist',
      open_url: 'https://open.spotify.com/track/123',
    },
  ],
};

describe('rss controller - feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockReturnValue({ sort: mockSort });
    mockSort.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ lean: mockLean });
  });

  it('returns valid RSS XML with correct content-type', async () => {
    mockLean.mockResolvedValue([SAMPLE_PLAYLIST]);

    const { req, res } = mockReqRes();
    await feed(req, res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/rss+xml; charset=utf-8');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');

    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<title>New.Music.Friday.US.02.14.2026</title>');
    expect(xml).toContain('Test Track');
    expect(xml).toContain('Test Artist');
    expect(xml).toContain('https://open.spotify.com/track/123');
  });

  it('filters by region when provided', async () => {
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ region: 'UK' });
    await feed(req, res);

    expect(mockFind).toHaveBeenCalledWith({ region: 'UK' });
    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain('New Music Friday (UK)');
  });

  it('filters by new region BR', async () => {
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ region: 'BR' });
    await feed(req, res);

    expect(mockFind).toHaveBeenCalledWith({ region: 'BR' });
    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain('New Music Friday (BR)');
  });

  it('uses "All Regions" label when no region filter is set', async () => {
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes();
    await feed(req, res);

    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain('New Music Friday (All Regions)');
  });

  it('ignores invalid region values', async () => {
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ region: 'INVALID' });
    await feed(req, res);

    expect(mockFind).toHaveBeenCalledWith({});
  });

  it('returns valid XML for empty results', async () => {
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes();
    await feed(req, res);

    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });

  it('escapes XML special characters in track data', async () => {
    const playlist = {
      ...SAMPLE_PLAYLIST,
      tracks: [
        {
          name: 'Rock & Roll <Live>',
          artist: 'Artist "X"',
          open_url: 'https://open.spotify.com/track/456',
        },
      ],
    };
    mockLean.mockResolvedValue([playlist]);

    const { req, res } = mockReqRes();
    await feed(req, res);

    const xml = res.send.mock.calls[0][0];
    // Track data is HTML-escaped inside a CDATA section (no double-escaping)
    expect(xml).toContain('<![CDATA[');
    expect(xml).toContain('Rock &amp; Roll &lt;Live&gt;');
    expect(xml).toContain('Artist &quot;X&quot;');
  });

  it('sorts by published_date descending and limits to 50', async () => {
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes();
    await feed(req, res);

    expect(mockSort).toHaveBeenCalledWith({ published_date: -1 });
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('returns 500 on database error', async () => {
    mockLean.mockRejectedValue(new Error('DB error'));

    const { req, res } = mockReqRes();
    await feed(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
