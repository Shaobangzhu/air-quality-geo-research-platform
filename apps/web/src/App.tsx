import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { pages, parseRoute, routeSearch } from './route-state.js';
import type { RoutePatch } from './route-state.js';
import { useStations } from './use-stations.js';
import { Icon } from './components/Icon.js';
import { ModeBadge } from './components/ModeBadge.js';
import { MapExplorer } from './map/MapExplorer.js';
export { pages } from './route-state.js';

export function App() {
  const [location, setLocation] = useState(() => ({
    path: window.location.pathname === '/' ? '/map' : window.location.pathname,
    route: parseRoute(window.location.search),
  }));
  const locationRef = useRef(location);
  locationRef.current = location;
  const data = useStations(location.route);
  const page = pages.find((item) => item.path === location.path);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const pop = () => {
      const next = {
        path:
          window.location.pathname === '/' ? '/map' : window.location.pathname,
        route: parseRoute(window.location.search),
      };
      locationRef.current = next;
      setLocation(next);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    document.title = `${page?.name ?? 'Page not found'} | Greater LA Air Quality`;
  }, [page]);
  useEffect(() => {
    const current = locationRef.current;
    const url = `${current.path}${routeSearch(current.route)}`;
    if (`${window.location.pathname}${window.location.search}` !== url)
      window.history.replaceState({}, '', url);
  }, [location]);
  const change = useCallback((patch: RoutePatch, replace = false) => {
    const current = locationRef.current;
    const route = parseRoute(routeSearch({ ...current.route, ...patch }));
    if (routeSearch(route) === routeSearch(current.route)) return;
    const next = { ...current, route };
    locationRef.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](
      {},
      '',
      `${current.path}${routeSearch(route)}`,
    );
    setLocation(next);
  }, []);
  const navigate = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const next = { ...locationRef.current, path };
    locationRef.current = next;
    window.history.pushState({}, '', `${path}${routeSearch(next.route)}`);
    setLocation(next);
    main.current?.focus();
  };
  return (
    <div className="workbench">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <header className="app-header">
        <a
          className="brand"
          href={`/map${routeSearch(location.route)}`}
          onClick={(event) => navigate(event, '/map')}
          aria-label="Greater LA workbench, Map Explorer"
        >
          <Icon name="mountain" className="brand-mark" />
          <span>
            <strong>Greater LA Air Quality Geo Research Platform</strong>
            <small>
              Interdisciplinary Research &amp; Software Engineering Workbench —
              v1
            </small>
          </span>
        </a>
        <nav aria-label="Workbench pages">
          {pages.map((item) => (
            <a
              key={item.path}
              href={`${item.path}${routeSearch(location.route)}`}
              onClick={(event) => navigate(event, item.path)}
              aria-current={location.path === item.path ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.name}
            </a>
          ))}
        </nav>
        <ModeBadge data={data} mode={location.route.mode} />
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        {location.path === '/map' ? (
          <MapExplorer
            route={location.route}
            data={data}
            change={change}
            analyze={(event) => navigate(event, '/analysis')}
          />
        ) : (
          <section className="placeholder-page">
            <p className="eyebrow">RESEARCH WORKBENCH · PLANNED MODULE</p>
            <Icon name={page?.icon ?? 'info'} className="placeholder-icon" />
            <h1>{page?.name ?? 'Page not found'}</h1>
            <p>
              {page?.description ?? 'Choose one of the four workbench pages.'}
            </p>
            {location.path === '/analysis' && location.route.station && (
              <p className="analysis-selection" role="status">
                Selected monitor:{' '}
                {data.status === 'ready'
                  ? (data.result.data.find(
                      (reading) =>
                        reading.station.id === location.route.station,
                    )?.station.name ?? 'Not present in this selection')
                  : 'Availability not confirmed'}
                <br />
                {location.route.pollutant} · {location.route.mode} ·{' '}
                {location.route.station}
              </p>
            )}
            <div className="placeholder-message">
              <h2>
                {page ? 'This workspace is planned' : 'Return to the workbench'}
              </h2>
              <p>
                {page
                  ? 'The interface for this module has not been implemented. The header shows availability of the selected station context; no analysis or results are displayed here.'
                  : 'Use the navigation to open an available workspace.'}
              </p>
            </div>
            <a
              className="primary-link"
              href={`/map${routeSearch(location.route)}`}
              onClick={(event) => navigate(event, '/map')}
            >
              Open Map Explorer
              <Icon name="arrow" />
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
