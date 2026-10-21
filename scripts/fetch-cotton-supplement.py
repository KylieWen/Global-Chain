"""Explicit public-source supplement for the cotton T-shirt release.

Raw successes are immutable. Trade requests stop on the first 429; no mirrors,
credentials, retry loops, or runtime integration are used.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from datetime import datetime, timezone
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'data/raw/cotton-tshirt-2026-10-21'
SOURCES = {
    'hs2022': ('un-comtrade-H6.json', 'https://comtradeapi.un.org/files/v1/app/reference/H6.json', 'United Nations Statistics Division'),
    'units': ('un-comtrade-quantity-units.json', 'https://comtradeapi.un.org/files/v1/app/reference/QuantityUnits.json', 'United Nations Statistics Division'),
    'unit-help': ('un-comtrade-supplementary-quantity-units.html', 'https://uncomtrade.org/docs/supplementary-quantity-units/', 'United Nations Statistics Division'),
    'yarn': ('cottonworks-yarn-spinning.html', 'https://cottonworks.com/learning-hub/yarn-manufacturing/yarn-spinning/', 'Cotton Incorporated'),
    'dyeing': ('cottonworks-dyeing-basics.html', 'https://cottonworks.com/learning-hub/dyeing/dyeing-basics/', 'Cotton Incorporated'),
    'garment': ('cottonworks-garment-construction.html', 'https://cottonworks.com/learning-hub/garment-manufacturing/garment-construction/', 'Cotton Incorporated'),
    'preparation': ('cottonworks-fiber-preparation.html', 'https://cottonworks.com/learning-hub/yarn-manufacturing/fiber-preparation-for-spinning/', 'Cotton Incorporated'),
    'finishing': ('cottonworks-mechanical-finishing.html', 'https://cottonworks.com/learning-hub/finishing/mechanical-finishing/', 'Cotton Incorporated'),
    'countries': ('un-m49-overview.html', 'https://unstats.un.org/unsd/methodology/m49/overview/', 'United Nations Statistics Division'),
    'bangladesh-2025': ('comtrade-50-610910-2025.json', 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=50&partnerCode=0%2C842&cmdCode=610910&flowCode=M%2CX&period=2025&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500', 'United Nations Statistics Division'),
    'india-2024': ('comtrade-356-610910-2024.json', 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=356&partnerCode=0%2C842&cmdCode=610910&flowCode=M%2CX&period=2024&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500', 'United Nations Statistics Division'),
}

def digest(body):
    return hashlib.sha256(body).hexdigest()

def fetch(key):
    name, url, publisher = SOURCES[key]
    target = DEST / name
    meta = DEST / (name + '.meta.json')
    if target.exists() and meta.exists():
        saved = json.loads(meta.read_text(encoding='utf-8'))
        assert digest(target.read_bytes()) == saved['sha256'], 'Existing snapshot hash changed'
        return saved
    entry = {'file': name, 'url': url, 'publisher': publisher, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'method': 'industry_primary' if publisher == 'Cotton Incorporated' else 'official'}
    try:
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (GlobeChain public-source research)'}), timeout=40) as response:
            body = response.read()
            entry.update(status='downloaded', httpStatus=response.status, finalUrl=response.geturl(), bytes=len(body), sha256=digest(body), contentType=response.headers.get('Content-Type'))
        if name.endswith('.json'):
            payload = json.loads(body)
            entry['recordCount'] = len(payload.get('data', payload.get('results', [])))
        target.write_bytes(body)
        meta.write_text(json.dumps(entry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except HTTPError as error:
        entry.update(status='failed', httpStatus=error.code, error=str(error))
    return entry

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='append', required=True, choices=SOURCES)
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST / 'manifest.json'
    prior = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'sources': []}
    entries = {row['file']: row for row in prior['sources']}
    for key in args.source:
        entry = fetch(key)
        entries[entry['file']] = entry
        print(json.dumps(entry, ensure_ascii=False), flush=True)
        if entry.get('httpStatus') == 429:
            print('429: stopped; no further requests.', flush=True)
            break
    manifest_path.write_text(json.dumps({'schemaVersion': 'cotton-supplement-snapshots.v1', 'sources': sorted(entries.values(), key=lambda row: row['file'])}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
