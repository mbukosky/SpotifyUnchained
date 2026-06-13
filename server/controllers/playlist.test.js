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

const { mockAggregate, mockCountDocuments } = Playlist._mocks;

// Pull a given pipeline stage out of the aggregate() argument for assertions.
function stage(name) {
  const pipeline = mockAggregate.mock.calls[0][0];
  const found = pipeline.find(s => Object.prototype.hasOwnProperty.call(s, name));
  return found ? found[name] : undefined;
}

function mockReqRes(query = {}) {
  const req = { query };
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('playlist controller - list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('ranks regions by menu order (US, UK, CA, BR, MX, DE) within a date', async () => {
    mockCountDocuments.mockResolvedValue(0);

    const { req, res } = mockReqRes();
    await list(req, res);

    // The $addFields stage computes a rank via the canonical region list, and
    // $sort applies it after published_date so same-date regions follow it.
    const rank = stage('$addFields')._regionRank;
    expect(rank).toEqual({ $indexOfArray: [['US', 'UK', 'CA', 'BR', 'MX', 'DE'], '$region'] });
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

  it('returns 500 on database error', async () => {
    mockCountDocuments.mockRejectedValue(new Error('DB error'));

    const { req, res } = mockReqRes();
    await list(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
