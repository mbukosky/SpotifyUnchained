// User Timing marks read by scripts/perf (all prefixed `su:`). They only
// record a timestamp and never change behaviour; browsers without the
// User Timing API are skipped silently.
export function mark(name, detail) {
  try {
    globalThis.performance?.mark?.(`su:${name}`, detail === undefined ? undefined : { detail });
  } catch {
    // Marks are diagnostics only.
  }
}

/** Mark once the next frame has been produced (a task queued after rAF). */
export function markPainted(name, detail) {
  if (typeof requestAnimationFrame !== 'function') {
    mark(name, detail);
    return;
  }
  requestAnimationFrame(() => setTimeout(() => mark(name, detail), 0));
}
