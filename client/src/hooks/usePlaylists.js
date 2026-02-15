import { useState, useEffect } from 'react';

export function usePlaylists({ page = 1, size = 5, sort = 'desc', region = 'US' }) {
  const [playlists, setPlaylists] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page, size, sort });
    params.set('region', region);

    fetch(`/spotify?${params}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch playlists');
        return res.json();
      })
      .then(data => {
        setPlaylists(data.items || []);
        setTotalCount(data.count || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, size, sort, region]);

  return { playlists, totalCount, loading, error };
}
