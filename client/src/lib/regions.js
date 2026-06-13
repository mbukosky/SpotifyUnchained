// 'ALL' is a client-side pseudo-region: the API returns every region when
// the region query param is omitted (see server/controllers/playlist.js).
export const REGIONS = ['ALL', 'US', 'UK', 'CA', 'BR', 'MX', 'DE'];

export const REGION_COLORS = {
  US: '#f5c451',
  UK: '#6db9ff',
  CA: '#ff6b6b',
  BR: '#5ce08a',
  MX: '#ff7ee2',
  DE: '#5ee6d0',
};
