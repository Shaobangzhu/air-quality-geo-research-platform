"""Optional offline audit. Requires Shapely 2.1.2; no network or DB access.
Usage: python scripts/verify-eaton-sources.py .local/milestone08
Checks retained original download bytes, re-derives curated GeoJSON and EPA rows.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile
import shapely
from shapely import make_valid
from shapely.geometry import box, mapping, shape
from shapely.geometry.polygon import orient

assert shapely.__version__ == '2.1.2', 'Use the documented geometry version'
root = Path(__file__).resolve().parent.parent / 'fixtures/historical/eaton-fire-2025'
source = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
for item in manifest['sources']:
    name = 'hourly_88101_2025.zip' if item['id'] == 'observations' else item['artifact']
    original = source / name
    assert hashlib.sha256(original.read_bytes()).hexdigest() == item['downloadSha256']
    assert hashlib.sha256((root / item['artifact']).read_bytes()).hexdigest() == item['sha256']
    if item['id'] == 'observations':
        with zipfile.ZipFile(original) as archive:
            stream = io.TextIOWrapper(archive.open(archive.namelist()[0]))
            header = next(stream)
            selected = [header] + [line for line in stream if line.startswith('"06","037","1103"') and '2025-01-0' in line]
            rows = [r for r in csv.DictReader(selected) if '2025-01-06' <= r['Date Local'] <= '2025-01-08' and r['POC'] == '3' and r['Method Code'] == '170']
        assert rows == json.loads((root / item['artifact']).read_text())
        print('Verified 71 original EPA rows, UTC/local time, method, qualifiers and revision dates')
        continue
    data = json.loads(original.read_text())
    assert not data.get('exceededTransferLimit')
    result = []
    for feature in data['features']:
        if item['id'] != 'perimeter' and feature['properties']['FHSZ'] not in [1, 2, 3]:
            continue
        geometry = shape(feature['geometry'])
        if not geometry.is_valid:
            geometry = make_valid(geometry)
        if item['id'] != 'perimeter':
            geometry = geometry.intersection(box(-118.25, 34.04, -117.95, 34.3))
        if geometry.is_empty:
            continue
        assert geometry.is_valid and geometry.geom_type in ['Polygon', 'MultiPolygon']
        polygons = list(geometry.geoms) if geometry.geom_type == 'MultiPolygon' else [geometry]
        feature['geometry'] = {'type': 'MultiPolygon', 'coordinates': [mapping(orient(p, sign=1))['coordinates'] for p in polygons]}
        result.append(feature)
    encoded = json.dumps({'type': 'FeatureCollection', 'features': result}, separators=(',', ':')).encode()
    assert hashlib.sha256(encoded).hexdigest() == item['sha256']
    print('Verified', item['id'], len(result), 'valid display features')
