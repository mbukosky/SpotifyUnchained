const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      $ENV: {
        SPOTIFY_CLIENT_ID: JSON.stringify(process.env.SPOTIFY_CLIENT_ID)
      }
    })
  ]
};