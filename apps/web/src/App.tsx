import { useEffect, useState } from 'react';
import { GREATER_LA, healthSchema } from '@aq/contracts';
import type { Health } from '@aq/contracts';

export const pages = [
  {
    path: '/map',
    name: 'Map Explorer',
    description:
      'Monitoring sites and geographic context across the study extent.',
  },
  {
    path: '/analysis',
    name: 'Analysis',
    description:
      'Pollutant exploration and time series with explicit measurement semantics.',
  },
  {
    path: '/wildfire',
    name: 'Wildfire Case Study',
    description:
      'Historical fire context with carefully bounded research questions.',
  },
  {
    path: '/data',
    name: 'Data & Methodology',
    description:
      'Sources, provenance, validation status and scientific limitations.',
  },
] as const;

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [apiState, setApiState] = useState<
    'checking' | 'ready' | 'unavailable'
  >('checking');
  const path =
    window.location.pathname === '/' ? '/map' : window.location.pathname;
  const page = pages.find((item) => item.path === path);
  useEffect(() => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 4000);
    let active = true;
    void fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API unavailable');
        return healthSchema.parse(await response.json());
      })
      .then((result) => {
        if (active) {
          setHealth(result);
          setApiState('ready');
        }
      })
      .catch(() => {
        if (active) setApiState('unavailable');
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      active = false;
      clearTimeout(deadline);
      controller.abort();
    };
  }, []);
  return (
    <div className="workbench">
      <aside className="sidebar">
        <a
          className="brand"
          href="/map"
          aria-label="Greater LA workbench, Map Explorer"
        >
          <span className="brand-mark" aria-hidden="true">
            LA
          </span>
          <span>
            Air Quality
            <br />
            Geo Research
          </span>
        </a>
        <p className="sidebar-label">RESEARCH WORKBENCH</p>
        <nav aria-label="Workbench pages">
          {pages.map((item, index) => (
            <a
              key={item.path}
              href={item.path}
              aria-current={path === item.path ? 'page' : undefined}
            >
              <span className="nav-number">0{index + 1}</span>
              {item.name}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Local-first foundation
          <p>Greater Los Angeles · v1</p>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <span>GREATER LOS ANGELES</span>
          <span className="milestone">MILESTONE 01 / FOUNDATION</span>
        </header>
        <main id="main">
          <p className="eyebrow">ENVIRONMENTAL DATA · GEOSPATIAL RESEARCH</p>
          <h1>
            Greater LA Air Quality
            <br className="desktop-break" /> Geo Research Platform
          </h1>
          <p className="subtitle">
            Interdisciplinary Research &amp; Software Engineering Workbench — v1
          </p>
          <section className="status-panel" aria-labelledby="status-title">
            <div>
              <p className="eyebrow" id="status-title">
                DATA STATUS
              </p>
              <h2>
                {apiState === 'checking'
                  ? 'Checking local service…'
                  : health
                    ? `Configured mode: ${health.data.mode}`
                    : 'Local API unavailable'}
              </h2>
              <p role="status">
                {health
                  ? health.data.state === 'unavailable'
                    ? 'Air-quality data unavailable — this milestone establishes the foundation.'
                    : health.data.label
                  : apiState === 'checking'
                    ? 'Waiting for the local API health check.'
                    : 'Data mode could not be verified. Start the local API and reload.'}
              </p>
            </div>
            <span className="badge">NO AIR-QUALITY DATA LOADED</span>
          </section>
          <section className="page-panel" aria-labelledby="page-title">
            <div className="section-heading">
              <p className="eyebrow">WORKSPACE</p>
              <span className="small-tag">
                {page ? 'PLANNED MODULE' : 'UNKNOWN ROUTE'}
              </span>
            </div>
            <h2 id="page-title">{page?.name ?? 'Page not found'}</h2>
            <p>
              {page?.description ?? 'Choose one of the four workbench pages.'}
            </p>
            <div className="empty-state">
              <span className="grid-symbol" aria-hidden="true">
                ⊞
              </span>
              <h3>
                {page
                  ? 'Foundation ready. Research modules come next.'
                  : 'Return to the workbench'}
              </h3>
              <p>
                {page
                  ? 'This page is a shell. No monitoring sites, maps, charts or provider results are displayed yet.'
                  : 'Use the navigation to open a planned page.'}
              </p>
            </div>
          </section>
          <section className="context-grid" aria-label="Research context">
            <div>
              <p className="eyebrow">STUDY EXTENT · WGS84</p>
              <p className="extent">
                {GREATER_LA.bbox.west.toFixed(2)},{' '}
                {GREATER_LA.bbox.south.toFixed(2)}
                <br />
                {GREATER_LA.bbox.east.toFixed(2)},{' '}
                {GREATER_LA.bbox.north.toFixed(2)}
              </p>
              <p>Engineering extent; not an air-basin boundary.</p>
            </div>
            <div>
              <p className="eyebrow">PROVENANCE FIRST</p>
              <p className="context-title">
                Explicit modes. Traceable sources.
              </p>
              <p>
                Sample means synthetic. Historical snapshots require official
                provenance. Live access is not implemented.
              </p>
            </div>
            <div>
              <p className="eyebrow">LOCAL SERVICE</p>
              <p className="context-title">
                {health
                  ? 'API responding'
                  : apiState === 'checking'
                    ? 'Checking API'
                    : 'API unavailable'}
              </p>
              <p>
                Database: {health?.database ?? 'unknown'}
                <br />
                Display time zone: America/Los_Angeles
              </p>
            </div>
          </section>
          <footer>
            Research and interview demonstration. Not for regulatory decisions,
            emergency response or personal exposure assessment.
          </footer>
        </main>
      </div>
    </div>
  );
}
