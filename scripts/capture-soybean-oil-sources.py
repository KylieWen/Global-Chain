"""Capture a small, serial official-source batch; stop immediately on HTTP 429."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timezone
import argparse, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'data/raw/soybean-oil-2026-10-21'
SOURCES = {
    'trade': ('comtrade-china-soy-2024.json', 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=156&partnerCode=0%2C76%2C842&cmdCode=150710%2C150790%2C120190%2C230400&flowCode=M%2CX&period=2024&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500', 'United Nations Statistics Division'),
    'china': ('usda-china-CH2025-0055.pdf', 'https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Oilseeds+and+Products+Annual_Beijing_China+-+People%27s+Republic+of_CH2025-0055.pdf', 'USDA Foreign Agricultural Service'),
    'brazil': ('usda-brazil-BR2025-0017.pdf', 'https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Oilseeds+and+Products+Update_Brasilia_Brazil_BR2025-0017.pdf', 'USDA Foreign Agricultural Service'),
    'usa': ('usda-ers-soy-processing-2025.html', 'https://www.ers.usda.gov/data-products/charts-of-note/112861', 'USDA Economic Research Service'),
    'refining': ('usda-ers-retail-oil-method-2025.html', 'https://www.ers.usda.gov/data-products/price-spreads-from-farm-to-consumer/documentation', 'USDA Economic Research Service'),
    'process': ('epa-vegetable-oil-process-1995.pdf', 'https://www.epa.gov/sites/production/files/2020-10/documents/b9s11-1.pdf', 'U.S. Environmental Protection Agency'),
}

def fetch(key):
    name, url, publisher = SOURCES[key]
    target, meta = DEST / name, DEST / (name + '.meta.json')
    if target.exists() and meta.exists():
        saved = json.loads(meta.read_text(encoding='utf8'))
        assert hashlib.sha256(target.read_bytes()).hexdigest() == saved['sha256']
        return saved
    entry = dict(file=name, url=url, publisher=publisher, retrievedAt=datetime.now(timezone.utc).isoformat(), method='official')
    try:
        with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0 (GlobeChain reviewed public-source batch)'}), timeout=45) as response:
            body=response.read()
            entry.update(status='downloaded', httpStatus=response.status, finalUrl=response.geturl(), bytes=len(body), sha256=hashlib.sha256(body).hexdigest(), contentType=response.headers.get('Content-Type'))
        if name.endswith('.json'):
            payload=json.loads(body); entry['recordCount']=len(payload.get('data',[]))
        target.write_bytes(body); meta.write_text(json.dumps(entry,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    except HTTPError as error: entry.update(status='failed', httpStatus=error.code, error=str(error))
    except (URLError, TimeoutError) as error: entry.update(status='failed', error=str(error))
    return entry

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--source',action='append',choices=SOURCES,required=True); args=parser.parse_args()
    DEST.mkdir(parents=True,exist_ok=True); path=DEST/'manifest.json'
    previous=json.loads(path.read_text(encoding='utf8')) if path.exists() else {'sources':[]}
    entries={row['file']:row for row in previous['sources']}
    for key in args.source:
        entry=fetch(key); entries[entry['file']]=entry; print(json.dumps(entry,ensure_ascii=False),flush=True)
        if entry.get('httpStatus')==429:
            print('HTTP 429: batch stopped; no further requests or alternate endpoint.',flush=True);break
    path.write_text(json.dumps({'schemaVersion':'soybean-oil-snapshots.v1','sources':list(entries.values())},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
