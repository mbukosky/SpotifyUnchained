import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Playlist model before importing the controller
vi.mock('../models/playlist.js', () => {
  const mockLean = vi.fn();
  const mockLimit = vi.fn(() => ({ lean: mockLean }));
  const mockSkip = vi.fn(() => ({ limit: mockLimit }));
  const mockSort = vi.fn(() => ({ skip: mockSkip }));
  const mockFind = vi.fn(() => ({ sort: mockSort }));
  const mockCountDocuments = vi.fn();

  return {
    default: {
      find: mockFind,
      countDocuments: mockCountDocuments,
      _mocks: { mockFind, mockSort, mockSkip, mockLimit, mockLean, mockCountDocuments },
    },
  };
});

import { list } from './playlist.js';
import Playlist from '../models/playlist.js';

const { mockFind, mockSort, mockSkip, mockLimit, mockLean, mockCountDocuments } = Playlist._mocks;

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
    // Reset the chain
    mockFind.mockReturnValue({ sort: mockSort });
    mockSort.mockReturnValue({ skip: mockSkip });
    mockSkip.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ lean: mockLean });
  });

  it('uses default pagination: page=1, size=5, sort=asc', async () => {
    const items = [{ title: 'test' }];
    mockCountDocuments.mockResolvedValue(1);
    mockLean.mockResolvedValue(items);

    const { req, res } = mockReqRes();
    await list(req, res);

    expect(mockSort).toHaveBeenCalledWith({ published_date: 1 });
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith({ count: 1, items });
  });

  it('respects query params (page, size, sort, region)', async () => {
    mockCountDocuments.mockResolvedValue(10);
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ page: '2', size: '10', sort: 'desc', region: 'UK' });
    await list(req, res);

    expect(mockFind).toHaveBeenCalledWith({ region: 'UK' });
    expect(mockCountDocuments).toHaveBeenCalledWith({ region: 'UK' });
    expect(mockSort).toHaveBeenCalledWith({ published_date: -1 });
    expect(mockSkip).toHaveBeenCalledWith(10); // (2-1) * 10
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('clamps size to max 100', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ size: '999' });
    await list(req, res);

    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it('clamps size to min 1', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ size: '-5' });
    await list(req, res);

    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('clamps page to minimum 1', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ page: '-5' });
    await list(req, res);

    expect(mockSkip).toHaveBeenCalledWith(0);
  });

  it('filters by new region CA', async () => {
    mockCountDocuments.mockResolvedValue(3);
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ region: 'CA' });
    await list(req, res);

    expect(mockFind).toHaveBeenCalledWith({ region: 'CA' });
    expect(mockCountDocuments).toHaveBeenCalledWith({ region: 'CA' });
  });

  it('ignores invalid region values', async () => {
    mockCountDocuments.mockResolvedValue(0);
    mockLean.mockResolvedValue([]);

    const { req, res } = mockReqRes({ region: 'INVALID' });
    await list(req, res);

    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockCountDocuments).toHaveBeenCalledWith({});
  });

  it('returns { count, items } shape', async () => {
    const items = [{ title: 'a' }, { title: 'b' }];
    mockCountDocuments.mockResolvedValue(2);
    mockLean.mockResolvedValue(items);

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
