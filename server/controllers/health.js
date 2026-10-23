import mongoose from 'mongoose';

const PING_TIMEOUT_MS = 5000;

// Pings MongoDB rather than just reporting "process is up". The 2026-10-23 outage
// had the process running and the homepage returning 200 while every query failed
// auth, so only a check that touches the database would have caught it.
export async function check(req, res) {
  res.set('Cache-Control', 'no-store');
  let timer;
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error(`MongoDB not connected (readyState ${mongoose.connection.readyState})`);
    }
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`MongoDB ping timed out after ${PING_TIMEOUT_MS}ms`)), PING_TIMEOUT_MS);
    });
    await Promise.race([mongoose.connection.db.admin().ping(), timeout]);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err.message);
    // Generic body: the endpoint is public, so don't echo upstream error details.
    res.status(503).json({ status: 'unavailable' });
  } finally {
    clearTimeout(timer);
  }
}
