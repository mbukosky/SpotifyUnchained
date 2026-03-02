import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import config from './config.js';
import { startSync } from './lib/sync.js';

mongoose.connect(config.dbUri).then(() => {
  console.log('MongoDB connected');
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
  startSync();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
