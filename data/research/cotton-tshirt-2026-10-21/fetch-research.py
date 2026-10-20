"""Fetch public primary-source research snapshots; never reads keys or changes published data.

Existing successful raw files are immutable and reused after SHA-256 verification.
Run with --extract-only to rebuild the text/JSON extracts without any network request.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import argparse
import hashlib
import json
import re
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
SOURCES = [
    ('usda-cotton-may-2025.pdf', 'https://www.fas.usda.gov/sites/default/files/2025-05/cotton.pdf', 'USDA FAS', '2025-05'),
    ('usda-china-CH2025-0087.pdf', "https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Cotton+and+Products+Annual_Beijing_China+-+People%27s+Republic+of_CH2025-0087.pdf", 'USDA FAS', '2025-04-23'),
    ('usda-bangladesh-BG2026-0003.pdf', 'https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Cotton+and+Products+Annual_Dhaka_Bangladesh_BG2026-0003.pdf', 'USDA FAS', '2026-04-06'),
    ('usda-india-IN2026-0020.pdf', 'https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Cotton+and+Products+Annual_New+Delhi_India_IN2026-0020.pdf', 'USDA FAS', '2026-04-03'),
    ('cottonworks-learning-hub.html', 'https://cottonworks.com/learning-hub/', 'Cotton Incorporated', None),
    ('cottonworks-growing-ginning.html', 'https://cottonworks.com/fiber/fiber-science/cotton-fiber-growth-harvesting-and-ginning/', 'Cotton Incorporated', None),
    ('cottonworks-knit-basics.html', 'https://cottonworks.com/learning-hub/knitting/knit-basics/', 'Cotton Incorporated', None)
]
for reporter,partners in [(156,'0,842'), (50,'0,842'), (356,'0,842'), (842,'0,50,156,356')]:
    for year in [2025,2024]:
        query=urlencode({'reporterCode':reporter,'partnerCode':partners,'cmdCode':'610910','flowCode':'M,X','period':year,'motCode':0,'partner2Code':0,'customsCode':'C00','maxRecords':500})
        SOURCES.append((f'comtrade-{reporter}-610910-{year}.json',f'https://comtradeapi.un.org/public/v1/preview/C/A/HS?{query}','United Nations Statistics Division',None))

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def fetch(source, extract_only=False):
    name,url,publisher,published=source
    path=RAW/name
    metadata=RAW/f'{name}.meta.json'
    if path.exists() and metadata.exists():
        saved=json.loads(metadata.read_text(encoding='utf-8'))
        assert saved['sha256']==digest(path.read_bytes()),f'Immutable raw hash mismatch: {name}'
        return saved
    if extract_only:
        return {'file':name,'url':url,'publisher':publisher,'status':'not-downloaded'}
    entry={'file':name,'url':url,'publisher':publisher,'publishedAt':published,'retrievedAt':utc_now(),'method':'official' if 'CottonWorks' not in publisher and publisher!='Cotton Incorporated' else 'industry_primary'}
    try:
        with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0 (GlobeChain primary-source research; public snapshots)'}),timeout=30) as response:
            body=response.read()
            entry.update({'status':'downloaded','httpStatus':response.status,'finalUrl':response.geturl(),'contentType':response.headers.get('Content-Type'),'bytes':len(body),'sha256':digest(body)})
        if name.endswith('.pdf'): assert body.startswith(b'%PDF'),f'Not a PDF response: {name}'
        if name.endswith('.json'):
            payload=json.loads(body)
            entry.update({'recordCount':len(payload.get('data',[])),'reportedCount':payload.get('count'),'previewLimit':500})
        path.write_bytes(body)
        metadata.write_text(json.dumps(entry,ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception as error:
        entry.update({'status':'failed','httpStatus':getattr(error,'code',None),'error':f'{type(error).__name__}: {error}'})
    print(json.dumps({'file':name,'status':entry['status'],'records':entry.get('recordCount'),'error':entry.get('error')},ensure_ascii=False),flush=True)
    return entry

def extract(manifest):
    out=ROOT/'extracts'
    out.mkdir(exist_ok=True)
    pdf_pages=[]
    trade=[]
    issues=[]
    for entry in manifest:
        if entry['status']!='downloaded': continue
        path=RAW/entry['file']
        if path.suffix=='.pdf':
            reader=PdfReader(path)
            pages=[{'page':index+1,'text':page.extract_text() or ''} for index,page in enumerate(reader.pages)]
            (out/f'{path.stem}.pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2),encoding='utf-8')
            pdf_pages.append({'file':entry['file'],'pages':len(pages),'keywordPages':[p['page'] for p in pages if re.search(r'ginning|supply chain|ready.made|Brazil|knitt|spinning|textile|dye',p['text'],re.I)]})
        elif path.suffix=='.json' and path.name.startswith('comtrade-'):
            payload=json.loads(path.read_bytes())
            if len(payload.get('data',[]))>=500: issues.append({'file':path.name,'issue':'preview cap reached; completeness is not established'})
            for row in payload.get('data',[]):
                if str(row.get('cmdCode'))!='610910': issues.append({'file':path.name,'issue':'unexpected commodity code'})
                if row.get('partnerCode')==0 and row.get('partnerDesc') not in [None,'','World']: issues.append({'file':path.name,'issue':'unexpected world partner label'})
                record={key:row.get(key) for key in ['period','refYear','classificationCode','isOriginalClassification','cmdCode','cmdDesc','aggrLevel','isLeaf','reporterCode','reporterDesc','partnerCode','partnerDesc','partner2Code','flowCode','flowDesc','primaryValue','cifvalue','fobvalue','qty','qtyUnitCode','qtyUnitAbbr','isQtyEstimated','netWgt','isNetWgtEstimated','isReported','isAggregate','motCode','customsCode']}
                record.update({'partnerScope':'world_total' if row.get('partnerCode')==0 else 'entity','rawSnapshot':path.name,'rawSha256':entry['sha256'],'requestUrl':entry['url'],'retrievedAt':entry['retrievedAt'],'valueCurrencyConvention':'current USD; UN Comtrade primaryValue','classificationMappingForNarrowTshirt':'aggregate: HS610910 also includes cotton singlets and other vests'})
                trade.append(record)
    (out/'trade-observations.json').write_text(json.dumps(trade,ensure_ascii=False,indent=2),encoding='utf-8')
    summary={'generatedAt':utc_now(),'researchOnly':True,'rawSources':len(manifest),'downloaded':sum(s['status']=='downloaded' for s in manifest),'failed':[s for s in manifest if s['status']!='downloaded'],'tradeRecordCount':len(trade),'worldTotalCount':sum(r['partnerScope']=='world_total' for r in trade),'bilateralCount':sum(r['partnerScope']=='entity' for r in trade),'periods':sorted(set(str(r['period']) for r in trade)),'pdfs':pdf_pages,'issues':issues}
    (ROOT/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--extract-only',action='store_true')
    parser.add_argument('--fetch',action='store_true',help='Explicitly permit downloading named sources only')
    parser.add_argument('--source',action='append',choices=[source[0] for source in SOURCES])
    args=parser.parse_args()
    if args.fetch and not args.source: parser.error('--fetch requires an explicit --source; no batch retry after rate limiting')
    previous_path=ROOT/'manifest.json'
    previous=json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {'sources':[]}
    entries={entry['file']:entry for entry in previous['sources']}
    if args.fetch and not args.extract_only:
        for source in SOURCES:
            if source[0] not in args.source: continue
            result=fetch(source)
            entries[source[0]]=result
            if result.get('httpStatus')==429:
                print('Public source returned 429; no further source requests in this run.',flush=True)
                break
    else:
        for source in SOURCES:
            if (RAW/source[0]).exists(): entries[source[0]]=fetch(source,True)
    results=list(entries.values())
    results.sort(key=lambda entry:entry['file'])
    (ROOT/'manifest.json').write_text(json.dumps({'schemaVersion':'research-snapshots.v1','generatedAt':utc_now(),'researchOnly':True,'sources':results},ensure_ascii=False,indent=2),encoding='utf-8')
    extract(results)
