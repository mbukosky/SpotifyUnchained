# Design

## Clipped save error alert

`PlaylistCard` sets the `.tracks` `max-height` from `scrollHeight`, but only when `expanded`, the track count or the playing track changes. The save error alert appears later inside `SavePlaylist`, so the card never re-measures. While expanded, a `ResizeObserver` on `.tracks-inner` re-measures whenever the content changes size, which also covers the embed opening.

## Region change resets the page

`PlaylistList` keeps the previous region in state and resets `page` to 1 during render when it differs. An effect would first fetch the stale page, then refetch.

## Keys inside the card header and track row

The header's and the track row's `onKeyDown` handlers act only when `e.target === e.currentTarget`. Keys on a nested button or link keep their native behavior, and their `click` handlers already stop propagation.

## Collapsed tracks

`.tracks` gets the `inert` attribute while the card is collapsed, which removes its contents from the tab order and the accessibility tree. React 19 supports `inert` as a boolean prop.
