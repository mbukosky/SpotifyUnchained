# Migration: Add Region Field to Playlists

Adds a `region` field (default `"US"`) to all existing playlists.

## Prerequisites

- Node.js 18+
- Production `.env` values (specifically `DB_URI` pointing to production MongoDB)

## Steps

1. **Back up the production database** (if not already done):

   ```bash
   mongodump --uri="<PRODUCTION_DB_URI>" --gzip --out=scripts/backup-$(date +%Y-%m-%d-%H%M%S)
   ```

2. **Load production config into `.env`:**

   Replace `DB_URI` in your local `.env` with the production MongoDB connection string. Keep a copy of your local value so you can restore it after.

   ```bash
   cp .env .env.local.bak
   ```

   Edit `.env` and set:
   ```
   DB_URI=<PRODUCTION_MONGODB_URI>
   ```

3. **Run the migration:**

   ```bash
   node scripts/migrate-add-region.js
   ```

   Expected output:
   ```
   Connected to MongoDB
   Updated 599 playlists with region: US
   Migration complete
   ```

   The script is idempotent — it only updates playlists where `region` does not exist, so running it twice is safe.

4. **Verify the migration:**

   ```bash
   node -e "
   require('dotenv').config();
   const mongoose = require('mongoose');
   const config = require('./config/config');
   mongoose.connect(config.db, { useNewUrlParser: true, useUnifiedTopology: true });
   mongoose.connection.once('open', async () => {
     const total = await mongoose.connection.db.collection('playlists').countDocuments();
     const withRegion = await mongoose.connection.db.collection('playlists').countDocuments({ region: { \$exists: true } });
     const without = await mongoose.connection.db.collection('playlists').countDocuments({ region: { \$exists: false } });
     const regions = await mongoose.connection.db.collection('playlists').distinct('region');
     console.log('Total playlists:', total);
     console.log('With region:', withRegion);
     console.log('Without region:', without);
     console.log('Distinct regions:', regions);
     await mongoose.disconnect();
   });
   "
   ```

   Expected: all playlists have `region`, none without, distinct regions = `["US"]`.

5. **Restore your local `.env`:**

   ```bash
   mv .env.local.bak .env
   ```

## Rollback

To remove the `region` field from all playlists (connect to production):

```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config/config');
mongoose.connect(config.db, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.once('open', async () => {
  const result = await mongoose.connection.db.collection('playlists').updateMany({}, { \$unset: { region: '' } });
  console.log('Removed region from', result.modifiedCount, 'playlists');
  await mongoose.disconnect();
});
"
```
