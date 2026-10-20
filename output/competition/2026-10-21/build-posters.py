"""Rebuild six editable competition poster drafts from approved concept art.

Dependencies: reportlab, pypdf, Pillow; Microsoft YaHei; bundled Poppler.
All product copy and palette choices live in COPY / STYLES below.
"""
from pathlib import Path
import json
import subprocess
import xml.etree.ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
POPLER = Path(r'C:/Users/12509/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
MM = 72 / 25.4
COPY = {
    'brand': 'GlobeChain',
    'headline': ['一件商品，', '连接整个世界。'],
    'tagline': '全球商品供应链与贸易数据可视化',
    'steps': [
        ('拆解商品', ['从成品、部件到原料，', '逐层读懂商品结构。']),
        ('看见分工', ['沿代表性路线展开，', '看见国家与生产环节。']),
        ('核验贸易', ['查看官方统计观察，', '带着来源继续研究。'])
    ],
    'boundary': '代表性供应链与官方贸易统计，分开展示。',
    'note': '主视觉为概念示意；代表性路线不代表唯一真实路线。',
    'draft': '参赛视觉设计初稿'
}
STYLES = {
    'future': {'label': '鲜明未来', 'bg': '#03162B', 'ink': '#F1F7FE', 'soft': '#9AB4CA', 'accent': '#66E2D3', 'line': '#28445B', 'kicker': 'TRACE THE CONNECTIONS'},
    'retro': {'label': '复古未来', 'bg': '#F3E8CE', 'ink': '#153C46', 'soft': '#557170', 'accent': '#DE5225', 'line': '#C3BDA7', 'kicker': 'THE WORLD WITHIN A PRODUCT'},
    'farfuture': {'label': '远未来', 'bg': '#F1F5FC', 'ink': '#243C56', 'soft': '#6E819A', 'accent': '#5E88BE', 'line': '#CCD9E9', 'kicker': 'A WORLD INSIDE EVERY PRODUCT'}
}
pdfmetrics.registerFont(TTFont('YaHei', 'C:/Windows/Fonts/msyh.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('YaHeiBold', 'C:/Windows/Fonts/msyhbd.ttc', subfontIndex=0))
SVG_NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)

class Artboard:
    def __init__(self, stem, width, height, physical_mm):
        self.stem, self.w, self.h = stem, width, height
        self.pdf = canvas.Canvas(str(ROOT / f'{stem}.pdf'), pagesize=(physical_mm[0]*MM, physical_mm[1]*MM), pageCompression=1)
        self.pdf.setTitle(f'GlobeChain - {stem} - design draft')
        self.pdf.setAuthor('GlobeChain')
        self.pdf.scale(physical_mm[0]*MM/width, physical_mm[1]*MM/height)
        self.svg = ET.Element(f'{{{SVG_NS}}}svg', {'width':f'{physical_mm[0]}mm','height':f'{physical_mm[1]}mm','viewBox':f'0 0 {width} {height}'})
    def rect(self,x,y,w,h,fill,stroke=None,lw=1):
        self.pdf.setFillColor(HexColor(fill))
        if stroke: self.pdf.setStrokeColor(HexColor(stroke))
        self.pdf.setLineWidth(lw)
        self.pdf.rect(x,y,w,h,fill=1,stroke=bool(stroke))
        ET.SubElement(self.svg,'rect',{'x':str(x),'y':str(self.h-y-h),'width':str(w),'height':str(h),'fill':fill,'stroke':stroke or 'none','stroke-width':str(lw)})
    def line(self,x1,y1,x2,y2,color,lw=1):
        self.pdf.setStrokeColor(HexColor(color)); self.pdf.setLineWidth(lw); self.pdf.line(x1,y1,x2,y2)
        ET.SubElement(self.svg,'line',{'x1':str(x1),'y1':str(self.h-y1),'x2':str(x2),'y2':str(self.h-y2),'stroke':color,'stroke-width':str(lw)})
    def circle(self,x,y,r,color,lw=1):
        self.pdf.setStrokeColor(HexColor(color)); self.pdf.setLineWidth(lw); self.pdf.circle(x,y,r,fill=0,stroke=1)
        ET.SubElement(self.svg,'circle',{'cx':str(x),'cy':str(self.h-y),'r':str(r),'fill':'none','stroke':color,'stroke-width':str(lw)})
    def text(self,x,y,s,size,color,bold=False):
        font='YaHeiBold' if bold else 'YaHei'
        width=pdfmetrics.stringWidth(s,font,size)
        assert x >= 0 and x+width <= self.w+1, (self.stem,s,x,width,self.w)
        self.pdf.setFont(font,size); self.pdf.setFillColor(HexColor(color)); self.pdf.drawString(x,y,s)
        element=ET.SubElement(self.svg,'text',{'x':str(x),'y':str(self.h-y),'font-family':'Microsoft YaHei, sans-serif','font-size':str(size),'font-weight':'700' if bold else '400','fill':color})
        element.text=s
    def image(self,name,x,y,w,h):
        self.pdf.drawImage(str(ROOT/'assets'/f'{name}.png'),x,y,width=w,height=h,mask='auto')
        ET.SubElement(self.svg,'image',{'x':str(x),'y':str(self.h-y-h),'width':str(w),'height':str(h),'href':f'assets/{name}.png','preserveAspectRatio':'none'})
    def save(self):
        self.pdf.showPage(); self.pdf.save()
        ET.ElementTree(self.svg).write(ROOT/f'{self.stem}.svg',encoding='utf-8',xml_declaration=True)

def a4(name, style):
    a=Artboard(f'{name}-a4',595.276,841.89,(210,297))
    bg,ink,soft,accent,line=(style[key] for key in ['bg','ink','soft','accent','line'])
    a.rect(0,0,a.w,a.h,bg)
    # The central visual keeps its original aspect ratio. All typography is live vector text.
    a.image(name,138,170,320,480)
    if name=='retro':
        a.rect(32,787,7,20,accent)
        a.text(48,786,COPY['brand'],27,ink,True)
        a.text(34,748,style['kicker'],8,accent,True)
        a.text(34,700,'一件商品，连接整个世界。',29,ink,True)
        a.line(34,677,561,677,ink,1)
        a.rect(34,132,527,28,accent)
        a.text(49,140,'拆解商品     /     看见分工     /     核验贸易',13,bg,True)
    elif name=='farfuture':
        a.text(36,795,COPY['brand'],24,ink,True)
        a.text(36,772,style['kicker'],7.5,soft)
        a.circle(536,794,16,accent,.7); a.circle(536,794,10,line,.6)
        a.text(36,716,COPY['headline'][0],36,ink,True)
        a.text(36,670,COPY['headline'][1],36,ink,True)
        a.line(36,147,559,147,line,.7)
        for index,(title,_) in enumerate(COPY['steps']):
            x=36+index*178
            a.text(x,126,f'0{index+1}',8,accent,True); a.text(x+23,125,title,15,ink,True)
    else:
        a.text(36,797,COPY['brand'],25,ink,True)
        a.text(36,775,style['kicker'],8,accent)
        a.line(36,754,92,754,accent,2)
        a.text(36,706,COPY['headline'][0],38,ink,True)
        a.text(36,657,COPY['headline'][1],38,ink,True)
        for index,(title,_) in enumerate(COPY['steps']):
            x=36+index*178
            a.text(x,135,f'0{index+1}',8,accent,True); a.text(x,111,title,18,ink,True)
    a.text(36,84,COPY['tagline'],10,ink)
    a.text(36,61,COPY['boundary'],8,soft)
    a.line(36,47,559,47,line,.6)
    a.text(36,30,COPY['note'],6.8,soft)
    a.text(464,30,COPY['draft'],6.8,soft)
    a.save()

def large(name,style):
    a=Artboard(f'{name}-80x120cm',800,1200,(800,1200))
    bg,ink,soft,accent,line=(style[key] for key in ['bg','ink','soft','accent','line'])
    a.rect(0,0,800,1200,bg)
    # Large-format layout is rebuilt as an editorial split, not a stretched A4 page.
    a.image(name,330,268,420,630)
    a.line(54,1095,746,1095,line,1)
    a.text(54,1120,COPY['brand'],35,ink,True)
    a.text(414,1128,style['kicker'],10,accent,True)
    a.text(54,1005,COPY['headline'][0],60,ink,True)
    a.text(54,926,COPY['headline'][1],60,ink,True)
    a.text(56,872,COPY['tagline'],17,soft)
    if name=='retro':
        a.rect(54,849,75,6,accent)
        a.line(308,295,308,800,accent,1)
    elif name=='farfuture':
        a.circle(724,1030,25,line,1); a.circle(724,1030,13,accent,.8)
        a.line(309,303,309,805,line,.7)
    else:
        a.line(54,846,129,846,accent,2)
        a.line(308,300,308,805,line,.7)
    for index,(title,body) in enumerate(COPY['steps']):
        y=760-index*163
        a.text(54,y,f'0{index+1}',27,accent,True)
        a.text(111,y,title,27,ink,True)
        for line_index,body_line in enumerate(body): a.text(56,y-43-line_index*26,body_line,15,soft)
        if index<2: a.line(56,y-93,269,y-93,line,.7)
    a.text(348,246,'CONCEPT VISUAL / 商品全球联系概念图',9,soft)
    if name=='retro':
        a.rect(54,166,692,53,accent)
        a.text(72,184,'代表性供应链  /  官方贸易统计',24,bg,True)
    else:
        a.line(54,218,746,218,line,1)
        a.text(54,172,'代表性供应链  /  官方贸易统计',25,ink,True)
    a.text(54,126,'分开展示，各自可回到来源。',17,soft)
    a.line(54,94,746,94,line,.7)
    a.text(54,66,COPY['note'],10,soft)
    a.text(54,42,COPY['draft'],9,soft)
    a.text(601,42,'GLOBECHAIN / 2026',8.5,soft)
    a.save()

if __name__=='__main__':
    outputs=[]
    for name,style in STYLES.items():
        a4(name,style); large(name,style)
        for size,expected in [('a4',(210,297)),('80x120cm',(800,1200))]:
            stem=f'{name}-{size}'
            path=ROOT/f'{stem}.pdf'
            reader=PdfReader(path)
            assert len(reader.pages)==1
            page=reader.pages[0]
            dimensions=[round(float(page.mediabox.width)/MM,2),round(float(page.mediabox.height)/MM,2)]
            assert all(abs(dimensions[i]-expected[i])<0.03 for i in (0,1)),dimensions
            content=page.extract_text()
            for keyword in ['GlobeChain','拆解商品','看见分工','核验贸易','概念示意']:
                assert keyword in content,(stem,keyword)
            subprocess.run([str(POPLER),'-png','-singlefile','-scale-to','1800',str(path),str(ROOT/f'{stem}-preview')],check=True,creationflags=0x08000000)
            outputs.append({'style':style['label'],'size_mm':dimensions,'pdf':path.name,'svg':f'{stem}.svg','preview':f'{stem}-preview.png','pages':1,'vector_text_extraction':'passed'})
    board=Image.new('RGB',(1200,1320),'#E2E7EB')
    draw=ImageDraw.Draw(board)
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
    for index,item in enumerate(outputs):
        col=index//2; row=index%2
        image=Image.open(ROOT/item['preview']).convert('RGB'); image.thumbnail((370,590))
        x=col*400+(400-image.width)//2; y=40+row*650
        board.paste(image,(x,y))
        draw.text((col*400+18,y+600),f"{item['style']} / {'A4' if row==0 else '80 x 120 cm'}",font=font,fill='#314654')
    board.save(ROOT/'six-designs-contact-sheet.png')
    report={'status':'design-drafts','outputs':outputs,'limitations':['Concept imagery is 1024 x 1536 pixels; large boards are physical-size design drafts, not 300 dpi print masters.','No QR code, public URL, coverage-count claim or AI product capability claim is included.','SVG text remains editable and uses local Microsoft YaHei; move the assets directory with the SVG files.','PDFs embed subset fonts. Printer-specific bleed, material, color proof and higher-resolution imagery are still required before production.']}
    (ROOT/'poster-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'pdf_count':len(outputs),'preview_count':len(outputs),'svg_count':len(outputs),'contact_sheet':str(ROOT/'six-designs-contact-sheet.png')},ensure_ascii=False))
