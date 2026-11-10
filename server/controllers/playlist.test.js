import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Playlist model before importing the controller
vi.mock('../models/playlist.js', () => {
  const mockAggregate = vi.fn();
  const mockCountDocuments = vi.fn();

  return {
    default: {
      aggregate: mockAggregate,
      countDocuments: mockCountDocuments,
      _mocks: { mockAggregate, mockCountDocuments },
    },
  };
});

import { list } from './playlist.js';
import Playlist from '../models/playlist.js';
import { invalidateArchive } from '../lib/archiveCache.js';

const { mockAggregate, mockCountDocuments } = Playlist._mocks;

// Pull a given pipeline stage out of the aggregate() argument for assertions.
function stage(name) {
  const pipeline = mockAggregate.mock.calls[0][0];
  const found = pipeline.find(s => Object.prototype.hasOwnProperty.call(s, name));
  return found ? found[name] : undefined;
}

// list() sends a pre-encoded body; this response records what was sent and
// exposes it as `res.json` calls, so assertions read like plain res.json ones.
function mockReqRes(query = {}) {
  const req = { query, headers: {}, method: 'GET' };
  const headers = {};
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn((k, v) => { headers[k.toLowerCase()] = v; }),
    end: vi.fn(body => { if (body) res.json(JSON.parse(Buffer.from(body).toString())); }),
    headers,
  };
  return { req, res };
}

describe('playlist controller - list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateArchive();
    mockAggregate.mockResolvedValue([]);
  });

  it('uses default pagination: page=1, size=5, sort=asc', async () => {
    const items = [{ title: 'test' }];
    mockCountDocuments.mockResolvedValue(1);
    mockAggregate.mockResolvedValue(items);

    const { req, res } = mockReqRes();
    await list(req, res);

    expect(stage('$sort')).toEqual({ published_date: 1, _regionRank: 1 });
    expect(stage('$skip')).toBe(0);
    expect(stage('$limit')).toBe(5);
    expect(res.json).toHaveBeenCalledWith({ count: 1, items });
  });

  it('respects query params (page, size, sort, region)', async () => {
    mockCountDocuments.mockResolvedValue(10);

    const { req, res } = mockReqRes({ page: '2', size: '10', sort: 'desc', region: 'UK' });
    await list(req, res);

    expect(stage('$match')).toEqual({ region: 'UK' });
    expect(mockCountDocuments).toHaveBeenCalledWith({ region: 'UK' });
    expect(stage('$sort')).toEqual({ published_date: -1, _regionRank: 1 });
    expect(stage('$skip')).toBe(10); // (2-1) * 10
    expect(stage('$limit')).toBe(10);
  });

  it('clamps size to max 100', async () => {
    mockCountDocuments.mockResolvedValue(0);

    const { req, res } = mockReqRes({ size: '999' });
    await list(req, res);

    expect(stage('$limit')).toBe(100);
  });

  it('clamps size to min 1', async () => {
    mockCountDocuments.mockResolvedValue(0);

    const { req, res } = mockReqRes({ size: '-5' });
    await list(req, res);

    expect(stage('$limit')).toBe(1);
  });

  it('clamps page to minimum 1', async () => {
    mockCountDocuments.mockResolvedValue(0);

    const { req, res } = mockReqRes({ page: '-5' });
    await list(req, res);

    expect(stage('$skip')).toBe(0);
  });

  it('filters by new region CA', async () => {
    mockCountDocuments.mockResolvedValue(3);

    const { req, res } = mockReqRes({ region: 'CA' });
    await list(req, res);

    expect(stage('$match')).toEqual({ region: 'CA' });
    expect(mockCountDocuments).toHaveBeenCalledWith({ region: 'CA' });
  });

  it('ignores invalid region values', async () => {
    mockCountDocuments.mockResolvedValue(0);

    const { req, res } = mockReqRes({ region: 'INVALID' });
    await list(req, res);

    expect(stage('$match')).toEqual({});
    expect(mockCountDocuments).toHaveBeenCalledWith({});
  });

  it('ranks regions by menu order (US, UK, CA, BR, MX, DE, AU) within a date', async () => {
    mockCountDocuments.mockResolvedValue(0);

    const { req, res } = mockReqRes();
    await list(req, res);

    // The $addFields stage computes a rank via the canonical region list, and
    // $sort applies it after published_date so same-date regions follow it.
    const rank = stage('$addFields')._regionRank;
    expect(rank).toEqual({ $indexOfArray: [['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'], '$region'] });
    expect(stage('$sort')).toEqual({ published_date: 1, _regionRank: 1 });
  });

  it('returns { count, items } shape', async () => {
    const items = [{ title: 'a' }, { title: 'b' }];
    mockCountDocuments.mockResolvedValue(2);
    mockAggregate.mockResolvedValue(items);

    const { req, res } = mockReqRes();
    await list(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result).toHaveProperty('count', 2);
    expect(result).toHaveProperty('items', items);
  });

  it('sends the same JSON res.json would, and serves a repeat query from memory', async () => {
    const items = [{ _id: 'x', title: 'a', published_date: new Date('2026-02-14T00:00:00Z') }];
    mockCountDocuments.mockResolvedValue(1);
    mockAggregate.mockResolvedValue(items);

    const first = mockReqRes({ page: '1', size: '5' });
    await list(first.req, first.res);
    const body = first.res.end.mock.calls[0][0];
    expect(Buffer.from(body).toString()).toBe(JSON.stringify({ count: 1, items }));
    expect(first.res.headers['content-type']).toBe('application/json; charset=utf-8');

    const again = mockReqRes({ page: '1', size: '5' });
    await list(again.req, again.res);
    expect(mockAggregate).toHaveBeenCalledTimes(1);
    expect(again.res.json).toHaveBeenCalledWith(JSON.parse(JSON.stringify({ count: 1, items })));
  });

  it('does not pre-encode or cache a page over the size limit', async () => {
    const items = [{ title: 'big', tracks: [{ name: 'x'.repeat(200 * 1024) }] }];
    mockCountDocuments.mockResolvedValue(1);
    mockAggregate.mockResolvedValue(items);

    const first = mockReqRes({ size: '100' });
    await list(first.req, first.res);
    const second = mockReqRes({ size: '100' });
    await list(second.req, second.res);

    expect(first.res.json).toHaveBeenCalledWith({ count: 1, items });
    expect(first.res.headers.etag).toBeUndefined();
    expect(first.res.headers['content-encoding']).toBeUndefined();
    expect(mockAggregate).toHaveBeenCalledTimes(2);
  });

  it('returns 500 on database error', async () => {
    mockCountDocuments.mockRejectedValue(new Error('DB error'));

    const { req, res } = mockReqRes();
    await list(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
