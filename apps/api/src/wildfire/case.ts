import { URL } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { wildfireManifestSchema, wildfireCaseSchema } from '@aq/contracts';
import type { WildfireCase } from '@aq/contracts';
import { normalizeImport } from '../bff/normalize.js';
const directory = new URL(
  '../../../../fixtures/historical/eaton-fire-2025/',
  import.meta.url,
);
export function loadWildfireCase(root = directory): WildfireCase {
  const read = (name: string, expected?: string) => {
    const url = new URL(name, root);
    if (statSync(url).size > 2_000_000)
      throw new Error('Case asset exceeds bounds.');
    const bytes = readFileSync(url);
    if (
      expected &&
      createHash('sha256').update(bytes).digest('hex') !== expected
    )
      throw new Error('Case checksum mismatch.');
    return JSON.parse(bytes.toString('utf8')) as unknown;
  };
  const manifest = wildfireManifestSchema.parse(read('manifest.json'));
  const layers: unknown[] = [];
  for (const source of manifest.sources) {
    const raw = read(source.artifact, source.sha256);
    if (source.id === 'observations') continue;
    const fc = raw as {
      type: string;
      features: { properties: Record<string, unknown>; geometry: unknown }[];
    };
    if (
      fc.type !== 'FeatureCollection' ||
      !Array.isArray(fc.features) ||
      fc.features.length > 100
    )
      throw new Error('Invalid bounded GeoJSON.');
    for (const f of fc.features) {
      const p = f.properties;
      if (source.id === 'perimeter') {
        if (
          p.FIRE_NAME !== 'EATON' ||
          p.YEAR_ !== 2025 ||
          p.INC_NUM !== manifest.event.incidentId ||
          String(p.IRWINID).replace(/[{}]/g, '') !== manifest.event.irwinId
        )
          throw new Error('Wrong incident geometry.');
      } else if (
        p.SRA !== source.id.toUpperCase() ||
        !['Moderate', 'High', 'Very High'].includes(
          String(p.FHSZ_Description),
        ) ||
        ['Moderate', 'High', 'Very High'][Number(p.FHSZ) - 1] !==
          p.FHSZ_Description
      )
        throw new Error('Invalid hazard classification.');
      layers.push({
        id: `${source.id}-${p.OBJECTID}`,
        sourceObjectId: p.OBJECTID,
        layer: source.id,
        category: source.id === 'perimeter' ? null : p.FHSZ_Description,
        geometry: f.geometry,
      });
    }
  }
  const batch = normalizeImport(
    read('observations.json', manifest.observationArtifactSha256),
  );
  return wildfireCaseSchema.parse({ manifest, layers, batch });
}
