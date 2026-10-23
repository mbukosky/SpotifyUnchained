import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('mongoose', () => {
  const ping = vi.fn();
  return {
    default: {
      connection: {
        readyState: 1,
        db: { admin: () => ({ ping }) },
      },
      _mocks: { ping },
    },
  };
});

import mongoose from 'mongoose';
import { check } from './health.js';

const { ping } = mongoose._mocks;

function mockReqRes() {
  const req = {};
  const res = {
    json: vi.fn(),
    set: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  mongoose.connection.readyState = 1;
  ping.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('health check', () => {
  it('returns ok when the database answers a ping', async () => {
    ping.mockResolvedValue({ ok: 1 });
    const { req, res } = mockReqRes();

    await check(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('returns 503 when the ping fails, e.g. after a password rotation', async () => {
    ping.mockRejectedValue(new Error('bad auth : authentication failed'));
    const { req, res } = mockReqRes();

    await check(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'unavailable' });
    expect(console.error).toHaveBeenCalledWith('Health check failed:', 'bad auth : authentication failed');
  });

  it('returns 503 without pinging when mongoose is disconnected', async () => {
    mongoose.connection.readyState = 0;
    const { req, res } = mockReqRes();

    await check(req, res);

    expect(ping).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 503 when the ping hangs', async () => {
    vi.useFakeTimers();
    ping.mockReturnValue(new Promise(() => {}));
    const { req, res } = mockReqRes();

    const pending = check(req, res);
    await vi.advanceTimersByTimeAsync(5000);
    await pending;

    expect(res.status).toHaveBeenCalledWith(503);
  });
});
