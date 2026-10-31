import { useEffect, useRef, useState } from 'react';
import { CorpusSources } from './CorpusSources.js';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  transparencyCatalogSchema,
  previewResponseSchema,
  usageSummarySchema,
  STUDY_REGIONS,
} from '@aq/contracts';
import type {
  ExportQuery,
  ExportRecord,
  TransparencyCatalog,
} from '@aq/contracts';
import type { RoutePatch, RouteState } from '../route-state.js';
import { METHODS } from './methods.js';
import { Icon } from '../components/Icon.js';
const TABS = [
  ['sources', 'Data Sources'],
  ['preview', 'Data Preview & Export'],
  ['methods', 'Scientific Methodology'],
  ['usage', 'API Usage'],
] as const;
function useRead<T>(url: string | null, parse: (input: unknown) => T) {
  const [state, setState] = useState<{
    key: string;
    status: 'ready' | 'error';
    value?: T;
  }>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);
    void fetch(url, { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Unavailable');
        return parse(await r.json());
      })
      .then((value) => {
        if (active) setState({ key: url, status: 'ready', value });
      })
      .catch(() => {
        if (active) setState({ key: url, status: 'error' });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timer);
    };
  }, [url, parse, refresh]);
  return {
    status: state?.key === url ? state.status : 'loading',
    value: state?.key === url ? state.value : undefined,
    refresh: () => {
      setState(undefined);
      setRefresh((v) => v + 1);
    },
  };
}
const parseCatalog = (v: unknown) => transparencyCatalogSchema.parse(v);
const parsePreview = (v: unknown) => previewResponseSchema.parse(v);
const parseUsage = (v: unknown) => usageSummarySchema.parse(v);
const format = (value: string | null) => value ?? 'Unknown / not supplied';
const queryString = (q: Partial<ExportQuery>) =>
  new URLSearchParams(
    Object.entries(q).filter(
      (v): v is [string, string] => typeof v[1] === 'string',
    ),
  ).toString();
export function DataWorkbench({
  route,
  change,
  navigate,
}: {
  route: RouteState;
  change: (patch: RoutePatch, replace?: boolean) => void;
  navigate: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
}) {
  const catalog = useRead('/api/data/catalog', parseCatalog);
  const [selected, setSelected] = useState<string>();
  const [filter, setFilter] = useState('all');
  const tab = route.dataTab;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const sources =
    catalog.value?.sources.filter(
      (s) => filter === 'all' || s.mode === filter,
    ) ?? [];
  const detail = catalog.value?.sources.find((s) => s.id === selected);
  const keyDown = (event: KeyboardEvent, index: number) => {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % 4
        : event.key === 'ArrowLeft'
          ? (index + 3) % 4
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 3
              : null;
    if (next !== null) {
      event.preventDefault();
      change({ dataTab: TABS[next]![0] });
      refs.current[next]?.focus();
    }
  };
  return (
    <section className="data-page">
      <div className="data-heading">
        <div>
          <p className="eyebrow">SOURCE EVIDENCE &amp; OPERATIONS</p>
          <h1>
            <Icon name="layers" /> Data &amp; Methodology
          </h1>
          <p>
            Inspect integrated sources, export a bounded selection and review
            measured API activity.
          </p>
        </div>
        <p className="data-disclaimer">
          Research and educational use. Source status, coverage and limitations
          travel with the data.
        </p>
      </div>
      <div
        className="data-tabs"
        role="tablist"
        aria-label="Data workbench sections"
      >
        {TABS.map(([id, label], index) => (
          <button
            key={id}
            id={`data-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`data-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            ref={(el) => {
              refs.current[index] = el;
            }}
            onClick={() => change({ dataTab: id })}
            onKeyDown={(e) => keyDown(e, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`data-panel-${tab}`}
        aria-labelledby={`data-tab-${tab}`}
      >
        {tab === 'sources' ? (
          <>
            <CorpusSources />
            <div className="data-section-heading">
              <h2>Integrated data sources</h2>
              <label>
                Source mode
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All sources</option>
                  <option value="historical">Historical</option>
                  <option value="sample">Synthetic sample</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="client-context">Client context</option>
                </select>
              </label>
              <button onClick={catalog.refresh}>Refresh catalog</button>
            </div>
            {catalog.status === 'loading' ? (
              <p role="status">Loading local source catalog…</p>
            ) : catalog.status === 'error' ? (
              <p role="alert">
                Source catalog unavailable. Check the local API.
              </p>
            ) : (
              <>
                <p className="data-caption">
                  Local snapshot database: {catalog.value?.database}. Eaton
                  assets: {catalog.value?.caseStatus}. Catalog generated{' '}
                  {catalog.value?.generatedAt}. Connection and scientific status
                  are shown separately.
                </p>
                <div className={`source-layout ${detail ? 'has-detail' : ''}`}>
                  <div className="data-table-wrap">
                    <table>
                      <caption>
                        Actually integrated sources and guarded service
                        boundaries
                      </caption>
                      <thead>
                        <tr>
                          <th>Provider / product</th>
                          <th>Mode / connection</th>
                          <th>Data status / version</th>
                          <th>Inspect</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <strong>{s.provider}</strong>
                              <span>{s.product}</span>
                              <small>{s.type}</small>
                            </td>
                            <td>
                              <span className={`data-chip ${s.mode}`}>
                                {s.mode}
                              </span>
                              <small>{s.connection}</small>
                            </td>
                            <td>
                              {s.dataStatus}
                              <small>{format(s.version)}</small>
                            </td>
                            <td>
                              <button
                                aria-label={`View source ${s.product}`}
                                aria-pressed={selected === s.id}
                                onClick={() => setSelected(s.id)}
                              >
                                Details →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {detail && (
                    <aside
                      className="source-detail"
                      aria-label="Source details"
                    >
                      <div className="data-section-heading">
                        <h2>{detail.product}</h2>
                        <button
                          onClick={() => setSelected(undefined)}
                          aria-label="Close source details"
                        >
                          ×
                        </button>
                      </div>
                      <dl>
                        {[
                          ['Provider', detail.provider],
                          ['Connection', detail.connection],
                          ['Scientific status', detail.dataStatus],
                          ['Spatial coverage', detail.spatialCoverage],
                          ['Temporal coverage', detail.temporalCoverage],
                          ['Version', format(detail.version)],
                          ['Release / issue', format(detail.released)],
                          ['Acquired', format(detail.retrievedAt)],
                          ['Revision', format(detail.revision)],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {detail.sourceReference.startsWith('https:') ? (
                        <a
                          href={detail.sourceReference}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Original source ↗
                        </a>
                      ) : (
                        <p>{detail.sourceReference}</p>
                      )}
                      <details className="source-limitations">
                        <summary>
                          Source limitations ({detail.limitations.length})
                        </summary>
                        <ul>
                          {detail.limitations.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </details>
                    </aside>
                  )}
                </div>
              </>
            )}
          </>
        ) : tab === 'preview' ? (
          <Preview catalog={catalog.value} route={route} />
        ) : tab === 'methods' ? (
          <section className="methods-panel">
            <h2>Scientific methodology &amp; key concepts</h2>
            <p>
              Guidance reflects the implemented records and source limitations.
            </p>
            {METHODS.map((m) => (
              <details key={m.title}>
                <summary>{m.title}</summary>
                <p>{m.text}</p>
                <a href={m.url} target="_blank" rel="noreferrer">
                  {m.source} ↗
                </a>
              </details>
            ))}
          </section>
        ) : (
          <UsagePanel />
        )}
      </div>
      {route.caseId && (
        <p className="data-caption">
          <a
            href="/wildfire?mode=historical"
            onClick={(e) => navigate(e, '/wildfire')}
          >
            Return to the historical case
          </a>
        </p>
      )}
    </section>
  );
}
function Preview({
  catalog,
  route,
}: {
  catalog: TransparencyCatalog | undefined;
  route: RouteState;
}) {
  const initial = route.caseId
    ? 'eaton-observations'
    : route.snapshotId
      ? route.snapshotId
      : route.mode === 'sample'
        ? route.product === 'forecast'
          ? 'sample-forecasts'
          : route.product === 'reporting-area-aqi'
            ? 'sample-area-aqi'
            : 'sample-stations'
        : '';
  const [datasetKey, setDatasetKey] = useState(initial);
  const choice = catalog?.datasets.find((d) => d.key === datasetKey);
  const [region, setRegion] = useState(route.region);
  const [pollutant, setPollutant] = useState(route.pollutant);
  const [kind, setKind] = useState<'aqi' | 'concentration'>(
    route.caseId ? 'concentration' : route.measurementType,
  );
  const [station, setStation] = useState<string | undefined>(
    route.station ?? route.area,
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [download, setDownload] = useState<'json' | 'csv' | null>(null);
  const [error, setError] = useState('');
  const currentQuery: Partial<ExportQuery> | null = choice
    ? {
        dataset: choice.dataset,
        region,
        pollutant: choice.pollutants.includes(pollutant)
          ? pollutant
          : choice.pollutants[0]!,
        measurementType: choice.measurementTypes.includes(kind)
          ? kind
          : choice.measurementTypes[0]!,
        ...(choice.snapshotId ? { snapshotId: choice.snapshotId } : {}),
        ...(station
          ? {
              [choice.dataset.startsWith('sample-area') ||
              choice.dataset === 'sample-forecasts'
                ? 'areaId'
                : 'stationId']: station,
            }
          : {}),
        ...(from && to ? { from: `${from}:00Z`, to: `${to}:00Z` } : {}),
        ...(validFrom && validTo
          ? { validFromDate: validFrom, validToDate: validTo }
          : {}),
      }
    : null;
  const signature = currentQuery ? queryString(currentQuery) : null;
  // A preview is explicit and invalidated by every selection change; tab changes never fetch a provider.
  const preview = useRead(
    submitted && submitted === signature
      ? `/api/data/preview?${submitted}&limit=10&offset=${offset}`
      : null,
    parsePreview,
  );
  const result = preview.value;
  const [identityOptions, setIdentityOptions] = useState<
    { id: string; label: string }[]
  >([]);
  useEffect(() => {
    if (result) setIdentityOptions(result.identities);
  }, [result]);
  const invalidate = () => {
    setSubmitted(null);
    setOffset(0);
    setError('');
  };
  const changeDataset = (key: string) => {
    setDatasetKey(key);
    setStation(undefined);
    setIdentityOptions([]);
    setFrom('');
    setTo('');
    setValidFrom('');
    setValidTo('');
    invalidate();
  };
  const load = () => {
    setError('');
    if (!!from !== !!to || !!validFrom !== !!validTo) {
      setError('Supply both range bounds.');
      return;
    }
    setOffset(0);
    setSubmitted(signature);
    preview.refresh();
  };
  const exportFile = async (format: 'json' | 'csv') => {
    if (!result || !submitted || submitted !== signature) return;
    setDownload(format);
    setError('');
    try {
      const response = await fetch(
        `/api/exports/${format}?${submitted}&selectionHash=${result.manifest.selectionHash}`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (!response.ok) throw new Error('Unavailable');
      const blob = await response.blob();
      if (blob.size > 3_000_000) throw new Error('Oversized');
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const name = disposition.match(
        /filename="(aq-[a-z-]+-[a-f0-9]{12}\.(?:csv|json))"/,
      )?.[1];
      if (!name) throw new Error('Unsafe name');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(
        'Export unavailable or selection changed. Reload the preview and check the bounded query.',
      );
    } finally {
      setDownload(null);
    }
  };
  return (
    <section className="preview-panel">
      <div className="data-section-heading">
        <h2>Data preview &amp; export</h2>
        <span className="data-chip">500 rows maximum · 3 MB</span>
      </div>
      <p>
        Select a local dataset explicitly. Exports contain all selected records
        (not just the preview page) and an embedded provenance manifest.
      </p>
      <div className="preview-filters">
        <label>
          Dataset
          <select
            value={datasetKey}
            onChange={(e) => changeDataset(e.target.value)}
          >
            <option value="">Choose an available dataset</option>
            {catalog?.datasets.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value as typeof region);
              setStation(undefined);
              setIdentityOptions([]);
              invalidate();
            }}
          >
            {STUDY_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pollutant
          <select
            disabled={!choice}
            value={currentQuery?.pollutant ?? pollutant}
            onChange={(e) => {
              setPollutant(e.target.value as typeof pollutant);
              setStation(undefined);
              setIdentityOptions([]);
              invalidate();
            }}
          >
            {(choice?.pollutants ?? ['PM2.5', 'O3', 'PM10']).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Measurement
          <select
            disabled={!choice || choice.measurementTypes.length < 2}
            value={currentQuery?.measurementType ?? kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              invalidate();
            }}
          >
            {(choice?.measurementTypes ?? ['concentration', 'aqi']).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          {choice?.dataset === 'sample-area-aqi' ||
          choice?.dataset === 'sample-forecasts'
            ? 'Reporting area'
            : 'Station / monitor'}
          <select
            value={station ?? ''}
            onChange={(e) => {
              setStation(e.target.value || undefined);
              invalidate();
            }}
          >
            <option value="">All matching identities</option>
            {identityOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {choice?.window ? (
          <>
            <label>
              From (UTC, inclusive)
              <input
                type="datetime-local"
                step="3600"
                value={from}
                min={choice.window.from.slice(0, 16)}
                max={choice.window.to.slice(0, 16)}
                onChange={(e) => {
                  setFrom(e.target.value);
                  invalidate();
                }}
                placeholder={choice.window.from}
              />
            </label>
            <label>
              To (UTC, exclusive)
              <input
                type="datetime-local"
                step="3600"
                value={to}
                min={choice.window.from.slice(0, 16)}
                max={choice.window.to.slice(0, 16)}
                onChange={(e) => {
                  setTo(e.target.value);
                  invalidate();
                }}
              />
            </label>
          </>
        ) : choice?.dataset === 'sample-forecasts' ? (
          <>
            <label>
              Valid date from (inclusive)
              <input
                type="date"
                value={validFrom}
                onChange={(e) => {
                  setValidFrom(e.target.value);
                  invalidate();
                }}
              />
            </label>
            <label>
              Valid date to (exclusive)
              <input
                type="date"
                value={validTo}
                onChange={(e) => {
                  setValidTo(e.target.value);
                  invalidate();
                }}
              />
            </label>
          </>
        ) : (
          <p className="data-caption">
            Source observation time may be unknown; no hourly filter is offered
            for this area product.
          </p>
        )}
        <button className="data-primary" onClick={load} disabled={!choice}>
          Load preview
        </button>
      </div>
      {choice?.window && (
        <p className="data-caption">
          Source coverage: {choice.window.from} → {choice.window.to}. Blank
          bounds use the source window; no missing-hour fill.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {submitted === signature && submitted && preview.status === 'loading' && (
        <p role="status">Loading bounded selection…</p>
      )}
      {submitted === signature && preview.status === 'error' && (
        <p role="alert">
          Preview unavailable. Check dataset, identity and date bounds; narrow
          selections exceeding 500 rows. No sample fallback occurs.
        </p>
      )}
      {result && (
        <>
          <p className="data-caption">
            {result.manifest.dataMode === 'sample'
              ? 'SYNTHETIC SAMPLE'
              : 'HISTORICAL'}{' '}
            · {result.manifest.source.label} · {result.manifest.rowCount}{' '}
            selected records · fetched {result.manifest.fetchedAt}
          </p>
          <div className="data-table-wrap">
            <table>
              <caption>
                Selected returned records · UTC instants / literal forecast
                dates
              </caption>
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Observed / validity</th>
                  <th>Pollutant / kind</th>
                  <th>Value / category</th>
                  <th>Source status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((r, index) => (
                  <PreviewRow key={index} row={r} />
                ))}
              </tbody>
            </table>
          </div>
          {result.data.length === 0 && (
            <p>
              No records match this selection. The manifest still records the
              query and source.
            </p>
          )}
          <div className="preview-actions">
            <p>
              {result.pagination.total ? result.pagination.offset + 1 : 0}–
              {Math.min(result.pagination.offset + 10, result.pagination.total)}{' '}
              of {result.pagination.total} selected records
            </p>
            <button
              disabled={offset === 0}
              onClick={() => setOffset((v) => Math.max(0, v - 10))}
            >
              Previous page
            </button>
            <button
              disabled={result.pagination.nextOffset === null}
              onClick={() => setOffset(result.pagination.nextOffset!)}
            >
              Next page
            </button>
            <button
              onClick={() => void exportFile('csv')}
              disabled={!!download}
            >
              Export CSV
            </button>
            <button
              onClick={() => void exportFile('json')}
              disabled={!!download}
            >
              Export JSON
            </button>
          </div>
          <p className="data-caption">
            CSV contains a manifest row followed by data rows. Null = \N; 0
            remains numeric. JSON and each CSV record_json field retain the
            complete source record. Export generation time is distinct from
            acquisition time.
          </p>
          <details className="export-provenance">
            <summary>Selection provenance &amp; limitations</summary>
            <p>
              Version: {format(result.manifest.source.version)} · Release:{' '}
              {format(result.manifest.source.release)} · Indexed:{' '}
              {format(result.manifest.indexedAt)}
            </p>
            <p>
              Units: {result.manifest.units.join(', ') || 'No selected values'}{' '}
              · Time zones: {result.manifest.timeZones.join('; ')}
            </p>
            <ul>
              {result.manifest.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <small>Selection SHA-256: {result.manifest.selectionHash}</small>
          </details>
        </>
      )}
    </section>
  );
}
function PreviewRow({ row: r }: { row: ExportRecord }) {
  if (r.kind === 'station-observation') {
    const o = r.observation;
    return (
      <tr>
        <td>
          {r.station.identity.nativeSiteId}
          <small>
            POC {r.station.identity.monitorId ?? 'unknown'} ·{' '}
            {r.station.identity.parameterId}
          </small>
        </td>
        <td>
          {o.observedAt}
          <small>{o.period.meaning}</small>
        </td>
        <td>
          {o.measurement.pollutant}
          <small>{o.measurement.kind}</small>
        </td>
        <td>
          {o.measurement.value === null ? 'Missing' : o.measurement.value}{' '}
          {o.measurement.unit}
        </td>
        <td>
          {o.dataStatus}
          <small>Qualifier: {o.raw.qualifier ?? 'none supplied'}</small>
        </td>
      </tr>
    );
  }
  const row = r.record;
  return (
    <tr>
      <td>
        {row.area.name}
        <small>{row.area.code}</small>
      </td>
      <td>
        {row.product === 'reporting-area-current-aqi'
          ? (row.observedAt ?? 'Unknown observation time')
          : row.validity.precision === 'date'
            ? `${row.validity.date} · date only`
            : `${row.validity.from} → ${row.validity.to}`}
        <small>
          {row.product === 'reporting-area-forecast'
            ? `Issued: ${row.issuedAt ?? 'unknown'}`
            : 'Reporting-area aggregate'}
        </small>
      </td>
      <td>
        {row.pollutant}
        <small>AQI</small>
      </td>
      <td>
        {row.aqi ?? 'Number not supplied'}
        <small>{row.category ?? 'Category not supplied'}</small>
      </td>
      <td>
        {row.product === 'reporting-area-forecast'
          ? 'Prediction'
          : row.dataStatus}
      </td>
    </tr>
  );
}
function UsagePanel() {
  const usage = useRead('/api/usage/summary', parseUsage);
  const value = usage.value;
  const total = value?.providers.reduce(
    (a, p) => ({
      attempts: a.attempts + p.requests,
      success: a.success + p.successes,
      fail: a.fail + p.failures,
      inFlight: a.inFlight + p.inFlight,
    }),
    { attempts: 0, success: 0, fail: 0, inFlight: 0 },
  );
  return (
    <section className="usage-panel">
      <div className="data-section-heading">
        <h2>API usage &amp; cache</h2>
        <span className="data-chip">Since Server Start</span>
        <button onClick={usage.refresh}>Refresh usage</button>
      </div>
      {usage.status === 'loading' ? (
        <p role="status">Reading measured process counters…</p>
      ) : usage.status === 'error' ? (
        <p role="alert">
          Usage unavailable. No estimated values are displayed.
        </p>
      ) : value && total ? (
        <>
          <p className="data-caption">
            Started {value.startedAt} · lastUpdatedAt {value.lastUpdatedAt}.
            Counters reset whenever the API process restarts.
          </p>
          <div className="usage-cards">
            {[
              ['Outbound attempts', total.attempts],
              [
                'Cache hit rate',
                value.cache.hitRate === null
                  ? '— (no lookups)'
                  : `${(value.cache.hitRate * 100).toFixed(1)}%`,
              ],
              ['Successful outbound', total.success],
              ['Failed outbound', total.fail],
            ].map(([label, n]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
          <p>
            {total.inFlight} attempts in flight. Cache lookups:{' '}
            {value.cache.hits} hits / {value.cache.misses} misses;{' '}
            {value.cache.coalesced} coalesced callers. Stale responses:{' '}
            {value.cache.staleResponses}.
          </p>
          <div className="data-table-wrap">
            <table>
              <caption>
                Measured BFF provider attempts · client traffic excluded
              </caption>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Attempts</th>
                  <th>Cache hits</th>
                  <th>Successes</th>
                  <th>Failures</th>
                  <th>In flight</th>
                  <th>Mean completed latency</th>
                </tr>
              </thead>
              <tbody>
                {value.providers.map((p) => (
                  <tr key={p.provider}>
                    <td>
                      {p.provider === 'airnow'
                        ? 'AirNow (guarded)'
                        : 'AQS (no HTTP adapter)'}
                    </td>
                    <td>{p.requests}</td>
                    <td>{p.cacheHits}</td>
                    <td>{p.successes}</td>
                    <td>{p.failures}</td>
                    <td>{p.inFlight}</td>
                    <td>
                      {p.averageLatencyMs === null
                        ? '—'
                        : `${p.averageLatencyMs.toFixed(1)} ms`}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>ArcGIS (client)</td>
                  <td colSpan={6}>
                    Not tracked locally ·{' '}
                    <a
                      href="https://location.arcgis.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Esri account usage ↗
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="usage-definitions">
            {Object.entries(value.definitions).map(([key, text]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <p className="data-disclaimer">
            These are operational counters, not a bill or credit estimate.
            Inbound BFF reads and database/file reads are not third-party HTTP
            attempts. Sample/historical-only activity can have zero outbound
            attempts.
          </p>
        </>
      ) : null}
    </section>
  );
}
