import type { RouteState } from '../route-state.js';
import type { DataState } from '../use-stations.js';
import { modeNames } from '../route-state.js';
export function ModeBadge({
  data,
  mode,
}: {
  data: DataState;
  mode: RouteState['mode'];
}) {
  return (
    <div
      className={`mode-badge ${data.status === 'ready' ? mode : 'unavailable'}`}
      role="status"
      aria-label="Data status"
    >
      <span className="status-dot" aria-hidden="true" />
      <span>
        {data.status === 'ready'
          ? `${modeNames[data.result.meta.dataMode]}${mode === 'sample' ? ' · Synthetic' : ''}`
          : data.status === 'loading'
            ? 'Unavailable · Checking'
            : 'Unavailable'}
      </span>
    </div>
  );
}
