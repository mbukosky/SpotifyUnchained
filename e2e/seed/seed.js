// Runs inside the e2e Mongo container on first start, against
// MONGO_INITDB_DATABASE. Two weeks across all seven regions: 14 playlists,
// 2 per region, 3 tracks each. Track data is invented.
// mongo:5.0 runs init scripts in the legacy shell, so this stays plain ES5.
var REGIONS = ['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'];
var FRIDAYS = [
  { label: '02.14.2026', date: new Date('2026-02-14T00:00:00Z') },
  { label: '02.07.2026', date: new Date('2026-02-07T00:00:00Z') },
];

var docs = [];
FRIDAYS.forEach(function (friday) {
  REGIONS.forEach(function (region) {
    var tracks = [1, 2, 3].map(function (n) {
      var id = 'e2e' + region + friday.label.replace(/\./g, '') + n;
      return {
        id: id,
        name: 'Test Track ' + n + ' ' + region,
        artist: 'Test Artist ' + n,
        added_at: friday.date,
        open_url: 'https://open.spotify.com/track/' + id,
        uri: 'spotify:track:' + id,
      };
    });
    docs.push({
      title: 'New.Music.Friday.' + region + '.' + friday.label,
      region: region,
      published_date: friday.date,
      tracks: tracks,
    });
  });
});

db.playlists.insertMany(docs);
