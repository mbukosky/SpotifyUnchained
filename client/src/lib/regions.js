// 'ALL' is a client-side pseudo-region: the API returns every region when
// the region query param is omitted (see server/controllers/playlist.js).
export const REGIONS = ['ALL', 'US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'];

export const REGION_COLORS = {
  US: '#f5c451',
  UK: '#6db9ff',
  CA: '#ff6b6b',
  BR: '#5ce08a',
  MX: '#ff7ee2',
  DE: '#5ee6d0',
  AU: '#b48cff',
};

// Regions whose playlist covers more than one country. The button spins
// between the code and the alternate face rather than widening to fit both:
// Spotify's AU playlist is "New Music Friday AU & NZ".
export const REGION_FLIP = {
  AU: { alt: 'NZ', name: 'Australia & New Zealand' },
};
