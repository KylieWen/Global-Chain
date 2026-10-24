from pathlib import Path
import json, sys
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
SOURCE=Path('C:/Users/12509/AppData/Local/Temp/codex-clipboard-29dbf40a-ee59-4e16-ba04-9ff7bad24999.png')
sys.path.insert(0,'D:/Global Chain/output/booth/qr-tools')
import zxingcpp

W,H=2560,1600
original=Image.open(SOURCE).convert('RGB')
decoded=zxingcpp.read_barcodes(original)
assert len(decoded)==1 and decoded[0].valid
payload=decoded[0].text
assert original.size==(2368,2368)
gray=original.convert('L')
matrix=[[gray.getpixel((x*64+32,y*64+32))<128 for x in range(37)] for y in range(37)]
assert all(not matrix[y][x] for y in range(37) for x in range(37) if x<4 or y<4 or x>=33 or y>=33)
# Reconstruct the original exact module pattern at an integer pixel pitch.
pitch=24
QR=Image.new('RGB',(37*pitch,37*pitch),'white')
qd=ImageDraw.Draw(QR)
for y,row in enumerate(matrix):
    for x,dark in enumerate(row):
        if dark:
            qd.rectangle((x*pitch,y*pitch,(x+1)*pitch-1,(y+1)*pitch-1),fill='black')
assert zxingcpp.read_barcodes(QR)[0].text==payload

font_regular='C:/Windows/Fonts/msyh.ttc'
font_bold='C:/Windows/Fonts/msyhbd.ttc'
def font(size,bold=False):
    return ImageFont.truetype(font_bold if bold else font_regular,size)

def curve(points,steps=100):
    a,b,c,d=points
    return [(round((1-t)**3*a[0]+3*(1-t)**2*t*b[0]+3*(1-t)*t*t*c[0]+t**3*d[0]),
             round((1-t)**3*a[1]+3*(1-t)**2*t*b[1]+3*(1-t)*t*t*c[1]+t**3*d[1]))
            for t in [i/steps for i in range(steps+1)]]

checks=[]
for theme in ['navy','ivory']:
    dark=theme=='navy'
    bg='#071e35' if dark else '#f3f0e7'
    panel='#0b2946' if dark else '#e8e6dc'
    line='#1a3d58' if dark else '#d4d9d5'
    fg='#f5f0df' if dark else '#102b45'
    secondary='#a1b7c7' if dark else '#586e7e'
    accent='#ed6a24'
    im=Image.new('RGB',(W,H),bg)
    d=ImageDraw.Draw(im)
    d.polygon([(1250,0),(2560,0),(2560,1600),(1180,1600),(1390,900)],fill=panel)
    # Sparse architectural contours stay away from the QR quiet zone.
    for offset in range(0,4):
        pts=curve([(-150,1050+offset*95),(410,460+offset*95),(900,1220+offset*95),(1380,760+offset*95)])
        d.line(pts,fill=line,width=2)
    d.line([(160,1180),(272,1180)],fill=accent,width=8)
    d.text((153,1210),'GLOBAL CHAIN',font=font(94,True),fill=fg)
    d.text((160,1340),'世界，环环相连',font=font(39,True),fill=secondary)
    # Original black/white modules and four-module quiet zone are untouched.
    qx,qy=1456,356
    d.rectangle((qx-18,qy-18,qx+QR.width+17,qy+QR.height+17),fill='#123550' if dark else '#deded4')
    im.paste(QR,(qx,qy))
    d.line([(qx,qy+QR.height+55),(qx+78,qy+QR.height+55)],fill=accent,width=6)
    d.text((qx+104,qy+QR.height+34),'扫码，探索世界的连接',font=font(29),fill=secondary)
    name=f'Global-Chain-QR-2560x1600-{theme}.png'
    target=ROOT/name
    im.save(target)
    actual=zxingcpp.read_barcodes(Image.open(target))
    assert len(actual)==1 and actual[0].valid and actual[0].text==payload
    for size in [(1920,1200),(1280,800)]:
        scaled=im.resize(size,Image.Resampling.LANCZOS)
        r=zxingcpp.read_barcodes(scaled)
        assert len(r)==1 and r[0].valid and r[0].text==payload
    assert im.crop((qx,qy,qx+QR.width,qy+QR.height)).tobytes()==QR.tobytes()
    checks.append({'file':name,'pixels':[W,H],'originalPayloadPreserved':True,
                   'qrModulesIncludingQuietZone':37,'modulePitchPx':pitch,'qrPixels':QR.size,
                   'quietZoneModules':4,'qrAreaPixelVerified':True,
                   'decodedAt':['2560x1600','1920x1200','1280x800']})
    print(name,'QR verified at three screen sizes')
(ROOT/'validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),'utf-8')
