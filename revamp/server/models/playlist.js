import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema({
  created: { type: Date, default: Date.now },
  id: String,
  name: String,
  artist: String,
  open_url: String,
  uri: String,
  added_at: Date,
});

const playlistSchema = new mongoose.Schema({
  title: String,
  region: { type: String, required: true, enum: ['US', 'UK'], default: 'US' },
  published_date: { type: Date, default: Date.now },
  tracks: [trackSchema],
});

playlistSchema.index({ region: 1, published_date: -1 });

const Playlist = mongoose.model('Playlist', playlistSchema);

export default Playlist;
