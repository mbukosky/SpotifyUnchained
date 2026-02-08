export default function Pagination({ page, size, totalCount, onPageChange, onSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
  const start = totalCount === 0 ? 0 : (page - 1) * size + 1;
  const end = Math.min(page * size, totalCount);

  return (
    <div className="pagination">
      <div className="pagination-size">
        <label htmlFor="pageSize">Items per page:</label>
        <select id="pageSize" value={size} onChange={e => onSizeChange(Number(e.target.value))}>
          {[5, 10, 15, 20].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <span className="pagination-info">{start} - {end} of {totalCount} items</span>
      <div className="pagination-nav">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12.5 15 L7.5 10 L12.5 5" />
          </svg>
        </button>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7.5 5 L12.5 10 L7.5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
