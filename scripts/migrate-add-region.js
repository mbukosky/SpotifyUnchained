'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');

mongoose.connect(config.db, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

db.once('open', async () => {
  console.log('Connected to MongoDB');
  try {
    const result = await db.collection('playlists').updateMany(
      { region: { $exists: false } },
      { $set: { region: 'US' } }
    );
    console.log(`Updated ${result.modifiedCount} playlists with region: US`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Migration complete');
  }
});
