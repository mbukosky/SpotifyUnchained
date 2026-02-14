import { useState } from 'react';
import { useRegion } from '../hooks/useRegion';
import { usePlaylists } from '../hooks/usePlaylists';
import PlaylistCard from './PlaylistCard';
import Pagination from './Pagination';

export default function PlaylistList() {
  const { region } = useRegion();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(5);
  const [sort] = useState('desc');

  const { playlists, totalCount, loading, error } = usePlaylists({ page, size, sort, region });

  const handleSizeChange = (newSize) => {
    setSize(newSize);
    setPage(1);
  };

  return (
    <>
      <div className="section-header">
        <div className="section-title-row">
          <h2 className="section-title">Archived Playlists</h2>
          <a className="kofi-link" href="https://ko-fi.com/A1439LK" target="_blank" rel="noopener noreferrer">
            <img height="32" src="https://cdn.ko-fi.com/cdn/kofi2.png?v=3" alt="Buy Me a Coffee at ko-fi.com" />
          </a>
        </div>
        <p className="section-subtitle">New Music Friday archives, preserved weekly</p>
      </div>

      {loading && (
        <div className="playlist-loading">
          <div className="loading-spinner" />
          <p>Loading playlists...</p>
        </div>
      )}

      {error && (
        <div className="playlist-error">
          <p>Failed to load playlists. Please try again.</p>
        </div>
      )}

      {!loading && !error && playlists.length === 0 && (
        <div className="playlist-empty">
          <p className="playlist-empty-title">No playlists found</p>
          <p>Try selecting a different region filter.</p>
        </div>
      )}

      {!loading && !error && playlists.length > 0 && (
        <>
          <div className="playlist-grid">
            {playlists.map((playlist, i) => (
              <PlaylistCard key={playlist._id} playlist={playlist} index={i} />
            ))}
          </div>
          <Pagination
            page={page}
            size={size}
            totalCount={totalCount}
            onPageChange={setPage}
            onSizeChange={handleSizeChange}
          />
        </>
      )}
    </>
  );
}
