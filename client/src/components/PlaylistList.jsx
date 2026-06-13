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
      <div className="section-head">
        <div>
          <h2 className="section-title">Archived Playlists</h2>
          <p className="section-sub">New Music Friday archives, preserved weekly</p>
        </div>
        <a className="kofi-link" href="https://ko-fi.com/A1439LK" target="_blank" rel="noopener noreferrer">
          ☕ Buy me a coffee
        </a>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading playlists...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Failed to load playlists. Please try again.</p>
        </div>
      )}

      {!loading && !error && playlists.length === 0 && (
        <div className="empty-state">
          <strong>No playlists found</strong>
          Try selecting a different region filter.
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
