import { useState } from 'react';

const DATE_VALUE = /^(\d{4})-\d{2}-\d{2}$/;

export default function WallControls({ first, last, dipping, onLuckyDip, onJump }) {
  const [value, setValue] = useState('');

  const onChange = (e) => {
    const v = e.target.value;
    setValue(v);
    // Typing a year into a date field reports each partial year (0002, 0020,
    // 0201...) as a complete date. Wait for a four-digit year before jumping.
    const match = DATE_VALUE.exec(v);
    if (match && Number(match[1]) >= 1000) onJump(v);
  };

  return (
    <div className="wall-controls">
      <button type="button" className="dip-btn" onClick={onLuckyDip} disabled={dipping} aria-busy={dipping}>
        <span className="dip-die" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
            <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </span>
        Lucky dip
      </button>
      <label className="jump">
        <span className="jump-label">Jump to a date</span>
        <input type="date" value={value} min={first} max={last} onChange={onChange} />
      </label>
    </div>
  );
}
