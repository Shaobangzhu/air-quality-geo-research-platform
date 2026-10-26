import { useEffect, useRef } from 'react';
import type { Station } from '@aq/contracts';
import type { RouteState } from '../route-state.js';
import { modeNames } from '../route-state.js';
import { Icon } from './Icon.js';
export function StationDrawer({
  station,
  mode,
  close,
}: {
  station: Station;
  mode: RouteState['mode'];
  close: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
  }, [station.id]);
  return (
    <aside
      className="station-drawer"
      aria-labelledby="station-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="panel-heading">
        <h2 id="station-title">
          <Icon name="pin" />
          Station Details
        </h2>
        <button
          ref={closeButton}
          className="icon-button"
          onClick={close}
          aria-label="Close station details"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="drawer-body">
        <span className="small-tag">
          {modeNames[mode]}
          {mode === 'sample' ? ' · FICTIONAL MONITOR' : ''}
        </span>
        <h3>{station.name}</h3>
        <p className="muted">
          {mode === 'sample'
            ? 'Synthetic fixture · Greater LA'
            : 'Monitoring identity · Greater LA'}
        </p>
        <dl className="detail-list">
          <div>
            <dt>Native site ID</dt>
            <dd>{station.identity.nativeSiteId}</dd>
          </div>
          <div>
            <dt>Monitor ID</dt>
            <dd>{station.identity.monitorId ?? 'Not supplied'}</dd>
          </div>
          <div>
            <dt>Parameter ID</dt>
            <dd>{station.identity.parameterId ?? 'Not supplied'}</dd>
          </div>
          <div>
            <dt>Source agency</dt>
            <dd>{station.sourceAgency}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>{station.identity.provider}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>
              {station.coordinate.latitude.toFixed(4)}°,{' '}
              {station.coordinate.longitude.toFixed(4)}°
            </dd>
          </div>
        </dl>
        <div className="info-note">
          <Icon name="info" />
          <p>
            {mode === 'sample'
              ? 'This is fictional station metadata for interface development. It is not a real monitoring location or measurement.'
              : 'Identity metadata only. Measurement values and validation status are not displayed in this milestone.'}
          </p>
        </div>
        <p className="drawer-next">
          Station map symbols and linked analysis are planned for the next
          milestone.
        </p>
      </div>
    </aside>
  );
}
