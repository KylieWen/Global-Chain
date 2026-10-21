"""Deterministic reviewed text and shared UN reference snapshot extraction."""
from pathlib import Path
from html.parser import HTMLParser
from pypdf import PdfReader
import hashlib,json

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'data/raw/soybean-oil-2026-10-21'
def digest(b):return hashlib.sha256(b).hexdigest()
class Text(HTMLParser):
    def __init__(self):super().__init__();self.parts=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ['script','style']:self.skip+=1
    def handle_endtag(self,tag):
        if tag in ['script','style']:self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        if not self.skip and data.strip():self.parts.append(data.strip())

for source in json.loads((DEST/'manifest.json').read_text(encoding='utf8'))['sources']:
    if source['status']!='downloaded':continue
    p=DEST/source['file'];assert digest(p.read_bytes())==source['sha256']
    if p.suffix=='.pdf':text='\n\n'.join(f'--- PDF PAGE {n+1} ---\n{page.extract_text()}' for n,page in enumerate(PdfReader(p).pages))+'\n'
    elif p.suffix=='.html':
        parser=Text();parser.feed(p.read_text(encoding='utf8'));text='\n'.join(parser.parts)+'\n'
    else:continue
    out=p.with_suffix('.txt');body=text.encode('utf8')
    if out.exists():assert out.read_bytes()==body,'Existing text changed; inspect extractor/library version'
    else:out.write_bytes(body)
    out.with_suffix('.txt.sha256').write_text(digest(body)+'\n',encoding='ascii')

# Reuse already downloaded official dictionaries, copying exact original bytes.
for name in ['un-comtrade-H6.json','un-comtrade-quantity-units.json']:
    old=ROOT/'data/raw/cotton-tshirt-2026-10-21'/name
    metadata=json.loads(old.with_name(name+'.meta.json').read_text(encoding='utf8'))
    body=old.read_bytes();assert digest(body)==metadata['sha256']
    target=DEST/name
    if target.exists():assert target.read_bytes()==body
    else:target.write_bytes(body)
    target.with_name(name+'.meta.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Verified originals, deterministic extracts and copied exact UN dictionaries.')
