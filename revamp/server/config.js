const config = {
  port: process.env.PORT || 3000,
  dbUri: process.env.DB_URI,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  skipSync: process.env.SKIP_SPOTIFY_SYNC === 'true',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
