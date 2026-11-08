/**
 * A keydown handler that runs `action` on Enter or Space, but only when the
 * element itself has focus. Keys on a button or link nested inside it keep
 * their native behavior.
 */
export function onOwnActivateKey(action) {
  return (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}
