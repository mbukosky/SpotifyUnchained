// Runs inside the e2e Mongo container on first start, against
// MONGO_INITDB_DATABASE. Track data is invented.
// mongo:5.0 runs init scripts in the legacy shell, so this stays plain ES5.
//
// 64 playlists: two weeks across all seven regions (14), plus 50 older AU weeks
// so the RSS 50-item cap and region pagination have something to bite on.
//   ALL 64 | AU 52 | US, UK, CA, BR, MX, DE 2 each
//
// Tests depend on these 02.14.2026 playlists:
//   US 30 tracks (card content)      UK 50 tracks (long list)
//   CA 250 tracks (save batching)    BR valid and malformed URIs
//   MX no valid URIs                 DE, AU 3 tracks
// and AU 02.07.2026 carries two extra tracks for the RSS field and escaping checks.
var REGIONS = ['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'];
var FRIDAYS = [
  { label: '02.14.2026', date: new Date('2026-02-14T00:00:00Z') },
  { label: '02.07.2026', date: new Date('2026-02-07T00:00:00Z') },
];
var TRACK_COUNTS = { 'US.02.14.2026': 30, 'UK.02.14.2026': 50, 'CA.02.14.2026': 250 };
var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function makeTrack(region, label, date, n) {
  // Spotify IDs are 22 alphanumerics; the app skips anything else when saving.
  var id = ('e2e' + region + label.replace(/\./g, '') + 'n' + n + 'xxxxxxxxxxxxxxxxxxxxxx').slice(0, 22);
  return {
    id: id,
    name: 'Test Track ' + n + ' ' + region,
    artist: 'Test Artist ' + n,
    added_at: date,
    open_url: 'https://open.spotify.com/track/' + id,
    uri: 'spotify:track:' + id,
  };
}

function makeTracks(region, label, date, count) {
  var tracks = [];
  for (var n = 1; n <= count; n++) tracks.push(makeTrack(region, label, date, n));
  return tracks;
}

var docs = [];
FRIDAYS.forEach(function (friday) {
  REGIONS.forEach(function (region) {
    var key = region + '.' + friday.label;
    var tracks = makeTracks(region, friday.label, friday.date, TRACK_COUNTS[key] || 3);

    if (key === 'BR.02.14.2026') {
      // Valid, empty, valid, too short, not a URI: 2 of 5 are saveable.
      tracks = makeTracks(region, friday.label, friday.date, 5);
      tracks[1].uri = '';
      tracks[3].uri = 'spotify:track:short';
      tracks[4].uri = 'not-a-uri';
    }
    if (key === 'MX.02.14.2026') {
      tracks[0].uri = '';
      tracks[1].uri = 'spotify:track:short';
      tracks[2].uri = 'not-a-uri';
    }
    if (key === 'AU.02.07.2026') {
      var fieldTrack = makeTrack(region, friday.label, friday.date, 4);
      fieldTrack.name = 'Test Track';
      fieldTrack.artist = 'Test Artist';
      fieldTrack.open_url = 'https://open.spotify.com/track/123';
      tracks.push(fieldTrack);

      var escapeTrack = makeTrack(region, friday.label, friday.date, 5);
      escapeTrack.name = 'Rock & Roll <Live>';
      escapeTrack.artist = 'Artist "X"';
      tracks.push(escapeTrack);
    }

    docs.push({
      title: 'New.Music.Friday.' + region + '.' + friday.label,
      region: region,
      published_date: friday.date,
      tracks: tracks,
    });
  });
});

for (var week = 1; week <= 50; week++) {
  var date = new Date(FRIDAYS[1].date.getTime() - week * WEEK_MS);
  var label = pad2(date.getUTCMonth() + 1) + '.' + pad2(date.getUTCDate()) + '.' + date.getUTCFullYear();
  docs.push({
    title: 'New.Music.Friday.AU.' + label,
    region: 'AU',
    published_date: date,
    tracks: makeTracks('AU', label, date, 1),
  });
}

db.playlists.insertMany(docs);
