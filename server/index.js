import 'dotenv/config';
import mongoose from 'mongoose';
import app, { staticReady } from './app.js';
import config from './config.js';
import { startSync } from './lib/sync.js';
import { warmIndex } from './controllers/editions.js';

mongoose.connect(config.dbUri).then(async () => {
  console.log('MongoDB connected');
  // Compress the built client and encode the edition index before the first
  // visitor asks for them. Both take well under a second; never wait more than five.
  const warm = warmIndex().catch(err => console.error('Warming the edition index failed:', err.message));
  await Promise.race([Promise.all([staticReady, warm]), new Promise(resolve => setTimeout(resolve, 5000))]);
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
  startSync();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
