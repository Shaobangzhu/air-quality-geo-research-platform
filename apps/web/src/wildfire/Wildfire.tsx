import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { HAZARD_NOTICE, wildfireCaseSchema } from '@aq/contracts';
import type { WildfireCase as Case, DataMode } from '@aq/contracts';
import { MapCanvas } from '../map/MapCanvas.js';
import type { StationMarker } from '../map/station-presentation.js';
import { Icon } from '../components/Icon.js';
export function useWildfire(enabled: boolean, mode: DataMode) {
  const [state, setState] = useState<{
    status: 'loading' | 'error' | 'ready';
    result?: Case;
    key?: string;
  }>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), 12000);
    void fetch(`/api/wildfire/eaton-fire-2025?mode=${mode}`, {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Unavailable');
        return wildfireCaseSchema.parse(await r.json());
      })
      .then((result) => {
        if (active) setState({ status: 'ready', result, key: mode });
      })
      .catch(() => {
        if (active) setState({ status: 'error', key: mode });
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      active = false;
      abort.abort();
      clearTimeout(deadline);
    };
  }, [enabled, mode]);
  return state.key === mode ? state : { status: 'loading' as const };
}
const localTime = (t: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(t));
const days = [
  {
    date: '2025-01-06',
    label: 'Before ignition',
    detail: 'Jan 6 · 24 supplied hours',
  },
  {
    date: '2025-01-07',
    label: 'Ignition day',
    detail: 'Jan 7 · daily context spans ignition',
  },
  {
    date: '2025-01-08',
    label: 'Later checkpoint',
    detail: 'Jan 8 · still during the incident',
  },
];
export function Wildfire({
  data,
  mode,
  openHistorical,
  navigate,
}: {
  data: ReturnType<typeof useWildfire>;
  mode: DataMode;
  openHistorical: () => void;
  navigate: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
}) {
  const [visible, setVisible] = useState([
    'perimeter',
    'sra',
    'lra',
    'stations',
  ]);
  const [day, setDay] = useState('2025-01-07');
  const [hour, setHour] = useState('18');
  const [selected, setSelected] = useState<string | undefined>();
  const [mapReady, setMapReady] = useState(false);
  const c = data.result;
  const at = new Date(`${day}T${hour}:00:00-08:00`)
    .toISOString()
    .replace('.000', '');
  const markers = useMemo<StationMarker[]>(
    () =>
      c?.batch.stations.map((s) => ({
        id: s.id,
        longitude: s.coordinate.longitude,
        latitude: s.coordinate.latitude,
        symbol: {
          style: 'circle',
          color: '#075ce5',
          label: 'Monitoring location (not AQI)',
        },
      })) ?? [],
    [c],
  );
  const feature = c?.layers.find((f) => f.id === selected);
  const station = c?.batch.stations.find((s) => s.id === selected);
  const row = c?.batch.observations.find(
    (o) => o.stationId === station?.id && o.observedAt === at,
  );
  const source = c?.manifest.sources.find((s) => s.id === feature?.layer);
  return (
    <section className="wildfire-page">
      <div className="case-heading">
        <div>
          <p className="eyebrow">CURATED HISTORICAL RESEARCH · 01</p>
          <h1>Wildfire Case Study</h1>
          <h2>
            <Icon name="fire" /> 2025 Eaton Fire
          </h2>
        </div>
        <div className="case-view">
          <span>2D terrain context</span>
          <button disabled title="3D is not implemented">
            3D unavailable
          </button>
        </div>
      </div>
      {data.status !== 'ready' || !c ? (
        <div className="case-card" role="status">
          <h2>
            {data.status === 'loading'
              ? 'Loading verified local case…'
              : mode !== 'historical'
                ? 'Historical case only'
                : 'BLOCKED — verified case unavailable'}
          </h2>
          <p>
            {mode !== 'historical'
              ? 'This case has no live or synthetic equivalent. Open the explicitly historical dataset.'
              : 'Local assets must pass source, checksum and geometry validation. No sample fallback is used.'}
          </p>
          {mode !== 'historical' && (
            <button onClick={openHistorical}>Open historical Eaton case</button>
          )}
        </div>
      ) : (
        <>
          <p className="case-notice">
            Study window: Jan 6–8, 2025 PST · 71 EPA hourly records at one
            contextual monitor. Incident: Jan 7–31.{' '}
            <strong>Static perimeter from firep25_1 (April 2026).</strong>
          </p>
          <div className="case-grid">
            <div>
              <div className="case-map">
                <MapCanvas
                  bounds={c.manifest.bbox}
                  boundaryVisible={false}
                  onAvailability={setMapReady}
                  markers={markers}
                  stationsVisible={visible.includes('stations')}
                  selectedId={selected}
                  onSelect={(ids) => setSelected(ids[0])}
                  caseLayers={c.layers}
                  visibleCaseLayers={visible}
                  onCaseSelect={setSelected}
                />
                <details className="case-legend" open>
                  <summary>Layers &amp; legend</summary>
                  {[
                    ['perimeter', 'Historical perimeter'],
                    ['sra', 'SRA · effective Apr 2024'],
                    ['lra', 'LRA · 2025 recommendations'],
                    ['stations', 'EPA monitor location'],
                  ].map(([id, label]) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={visible.includes(id!)}
                        onChange={() => {
                          setVisible((v) =>
                            v.includes(id!)
                              ? v.filter((x) => x !== id)
                              : [...v, id!],
                          );
                          setSelected(undefined);
                        }}
                      />
                      {label}
                    </label>
                  ))}
                  <div className="hazard-key">
                    <span>
                      <i style={{ background: '#f3d461' }} />
                      Moderate
                    </span>
                    <span>
                      <i style={{ background: '#ed9a43' }} />
                      High
                    </span>
                    <span>
                      <i style={{ background: '#e45c62' }} />
                      Very High
                    </span>
                  </div>
                  <small>Blue point: monitor, not AQI. Unmapped ≠ Low.</small>
                  <label>
                    <input type="checkbox" disabled />
                    Official AirNow contours — unverified
                  </label>
                  <label>
                    <input type="checkbox" disabled />
                    Smoke / wind — unavailable
                  </label>
                </details>
              </div>
              <p className="case-caption">
                CAL FIRE / OSFM / FRAP · US EPA AirData · Terrain: Esri basemap
                relief.{' '}
                {mapReady
                  ? 'Click a hazard polygon or monitor to inspect.'
                  : 'Map unavailable; all source and monitor details remain accessible below.'}
              </p>
              <section className="case-card">
                <h2>
                  <Icon name="clock" /> Study timeline
                </h2>
                <p>
                  The perimeter stays fixed. Checkpoints select monitor records
                  only.
                </p>
                <div className="case-timeline">
                  {days.map((d) => (
                    <button
                      key={d.date}
                      aria-pressed={day === d.date}
                      onClick={() => {
                        setDay(d.date);
                        setSelected(c.batch.stations[0]?.id);
                      }}
                    >
                      <strong>{d.label}</strong>
                      <span>{d.detail}</span>
                    </button>
                  ))}
                </div>
                <label className="case-hour">
                  Observation hour (PST)
                  <select
                    value={hour}
                    onChange={(e) => {
                      setHour(e.target.value);
                      setSelected(c.batch.stations[0]?.id);
                    }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={String(h).padStart(2, '0')}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </label>
                <small>
                  Ignition date is documented; the Jan 7 daily context includes
                  hours before ignition. Jan 8 is not “post-fire.”
                </small>
              </section>
            </div>
            <aside className="case-sidebar" aria-label="Case context">
              <section className="case-card">
                <h2>Case context</h2>
                <p>{c.manifest.event.location}</p>
                <dl>
                  <dt>Started / contained</dt>
                  <dd>Jan 7 / Jan 31, 2025</dd>
                  <dt>Incident identity</dt>
                  <dd>LAC · {c.manifest.event.incidentId}</dd>
                  <dt>Monitoring coverage</dt>
                  <dd>06-037-1103 · POC 3 · PM2.5</dd>
                  <dt>Window / gaps</dt>
                  <dd>72 hourly slots · 71 rows · 1 absent</dd>
                </dl>
                <a
                  href={c.manifest.event.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  CAL FIRE incident record ↗
                </a>
              </section>
              <section className="case-card">
                <h2>Research context</h2>
                <ol>
                  <li>
                    The monitor is south of the fire; its measurements do not
                    represent every location inside the perimeter.
                  </li>
                  <li>
                    2025 LRA recommendations were released after ignition. Local
                    adoption dates are not established here.
                  </li>
                  <li>
                    Terrain and hazard overlap do not establish why a
                    concentration changed.
                  </li>
                </ol>
                <p className="case-notice">{HAZARD_NOTICE}</p>
              </section>
              <section className="case-card" aria-label="Selected context">
                <h2>
                  {feature
                    ? 'Selected geographic feature'
                    : station
                      ? 'Selected monitor'
                      : 'Inspect the case'}
                </h2>
                <label>
                  Context selection
                  <select
                    aria-label="Context selection"
                    value={selected ?? ''}
                    onChange={(e) => setSelected(e.target.value || undefined)}
                  >
                    <option value="">Choose a monitor or mapped feature</option>
                    {visible.includes('stations') &&
                      c.batch.stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · POC {s.identity.monitorId}
                        </option>
                      ))}
                    {c.layers
                      .filter((f) => visible.includes(f.layer))
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.layer.toUpperCase()} ·{' '}
                          {f.category ?? 'Historical perimeter'} · #
                          {f.sourceObjectId}
                        </option>
                      ))}
                  </select>
                </label>
                {feature && source ? (
                  <>
                    <dl>
                      <dt>Classification</dt>
                      <dd>
                        {feature.category ?? 'Historical final perimeter'}
                      </dd>
                      <dt>Jurisdiction</dt>
                      <dd>
                        {feature.layer === 'perimeter'
                          ? 'Incident boundary'
                          : feature.layer.toUpperCase()}
                      </dd>
                      <dt>Dataset version</dt>
                      <dd>{source.version}</dd>
                      <dt>Released</dt>
                      <dd>{source.released}</dd>
                      <dt>Effective / adopted</dt>
                      <dd>{source.effective ?? 'Not established here'}</dd>
                    </dl>
                    <p>
                      {feature.layer === 'lra'
                        ? 'Published after ignition; not an as-of-Jan-7 layer.'
                        : feature.layer === 'perimeter'
                          ? 'Fixed historical geometry, not progressive fire growth.'
                          : HAZARD_NOTICE}
                    </p>
                    <a
                      href={source.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official layer source ↗
                    </a>
                  </>
                ) : station ? (
                  <>
                    <h3>
                      {station.name} · POC {station.identity.monitorId}
                    </h3>
                    <p>
                      {localTime(at)} · hour beginning
                      <br />
                      <small>{at}</small>
                    </p>
                    <p className="case-reading">
                      {row?.measurement.value == null
                        ? 'Missing observation'
                        : `${row.measurement.value} ${row.measurement.unit}`}
                    </p>
                    <p>
                      Parameter 88101 · method 170 · concentration, not AQI.
                    </p>
                    <p>
                      Source qualifier:{' '}
                      {row?.raw.qualifier ??
                        (row ? 'None supplied' : 'No row supplied')}
                      <br />
                      Status: historical AQS; row certification unknown.
                    </p>
                    <p>
                      {row?.period.averagingDescription ??
                        'Absent slot; no zero fill or interpolation.'}
                    </p>
                    <p>
                      Time window: 1 hour. Source Date GMT / Time GMT retained.
                    </p>
                  </>
                ) : (
                  <p>
                    Select a feature on the map or use this keyboard-accessible
                    list.
                  </p>
                )}
              </section>
              <a
                className="primary-link"
                href="/data?case=eaton-fire-2025&mode=historical"
                onClick={(e) => navigate(e, '/data')}
              >
                View Data &amp; Methodology <Icon name="arrow" />
              </a>
            </aside>
          </div>
          <details className="case-card case-sources">
            <summary>Sources, versions &amp; scientific limitations</summary>
            <CaseSources data={c} />
          </details>
        </>
      )}
    </section>
  );
}
export function CaseSources({ data }: { data: Case }) {
  return (
    <>
      <ul>
        {data.manifest.sources.map((s) => (
          <li key={s.id}>
            <a href={s.originalUrl} target="_blank" rel="noreferrer">
              {s.attribution} — {s.version}
            </a>
            <p>
              Released: {s.released} · Effective:{' '}
              {s.effective ?? 'not established'} · Retrieved: {s.retrievedAt}
            </p>
            <small>SHA-256: {s.sha256}</small>
          </li>
        ))}
      </ul>
      <ul>
        {data.manifest.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p>
        Public CAL FIRE data carry no warranty of accuracy. Display geometry is
        repaired and bounded; source download checksums and transformation
        details are retained in the local manifest. No paid provider call is
        needed to inspect this snapshot.
      </p>
    </>
  );
}
