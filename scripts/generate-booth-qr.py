"""Generate and independently decode the public Global Chain booth QR assets.

Run with the bundled Python (Pillow available). Optional small QR-only packages
can live outside product dependencies in output/booth/qr-tools; configure their
directory with --lib-dir. No site deployment or remote write is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import importlib.metadata
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://62.171.148.193/")
    parser.add_argument("--output-dir", default="output/booth/2026-10-24")
    parser.add_argument("--lib-dir", default="output/booth/qr-tools")
    parser.add_argument("--name", default="global-chain-home")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = (root / args.output_dir).resolve()
    library = (root / args.lib_dir).resolve()
    if not output.is_relative_to(root):
        raise ValueError("Output must remain inside this project workspace")
    if not args.name or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for character in args.name):
        raise ValueError("Use a short lowercase filename prefix")
    if not args.url.startswith(("http://", "https://")):
        raise ValueError("The QR target must be a complete HTTP(S) address")
    sys.path.insert(0, str(library))
    import qrcode
    import zxingcpp
    from PIL import Image, ImageDraw

    files = {
        "png": output / f"{args.name}-qr.png",
        "svg": output / f"{args.name}-qr.svg",
        "print": output / f"{args.name}-print.html",
        "verification": output / f"{args.name}-verification.json",
    }
    if any(file.exists() for file in files.values()):
        raise FileExistsError("These QR assets already exist; choose --name or a new output directory to preserve them")

    request = urllib.request.Request(args.url, headers={"User-Agent": "Global-Chain-Booth-QR-Verification/1.0"})
    with urllib.request.urlopen(request, timeout=25) as response:
        status, final_url = response.status, response.url
        body = response.read()
    if status != 200 or "Global Chain" not in body.decode("utf-8", errors="replace"):
        raise RuntimeError("The QR destination did not return the expected Global Chain page")

    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=64, border=4)
    qr.add_data(args.url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    modules = len(matrix)
    output.mkdir(parents=True, exist_ok=True)
    png = qr.make_image(fill_color="black", back_color="white").get_image().convert("RGB")
    png.save(files["png"], format="PNG", dpi=(600, 600))

    # qrcode supplies the standard QR matrix; an explicit vector grid makes the
    # quiet zone and printing geometry independent of raster resolution.
    namespace = "http://www.w3.org/2000/svg"
    ET.register_namespace("", namespace)
    svg = ET.Element(f"{{{namespace}}}svg", {"viewBox": f"0 0 {modules} {modules}", "width": "120mm", "height": "120mm", "shape-rendering": "crispEdges", "role": "img", "aria-label": "扫码访问 Global Chain"})
    ET.SubElement(svg, f"{{{namespace}}}rect", {"x": "0", "y": "0", "width": str(modules), "height": str(modules), "fill": "#fff"})
    for y, row in enumerate(matrix):
        for x, dark in enumerate(row):
            if dark:
                ET.SubElement(svg, f"{{{namespace}}}rect", {"x": str(x), "y": str(y), "width": "1", "height": "1", "fill": "#000"})
    svg_text = ET.tostring(svg, encoding="unicode")
    files["svg"].write_text(svg_text + "\n", encoding="utf-8", newline="\n")

    # Decode the actual written PNG using an implementation independent of the
    # generator. Separately rasterize the written SVG's rectangles and decode it.
    decoded_png = zxingcpp.read_barcode(Image.open(files["png"]))
    parsed_svg = ET.parse(files["svg"]).getroot()
    scale = 24
    svg_raster = Image.new("RGB", (modules * scale, modules * scale), "white")
    draw = ImageDraw.Draw(svg_raster)
    for rectangle in parsed_svg.findall(f"{{{namespace}}}rect"):
        if rectangle.get("fill") != "#000":
            continue
        x, y = int(rectangle.get("x")) * scale, int(rectangle.get("y")) * scale
        width, height = int(rectangle.get("width")) * scale, int(rectangle.get("height")) * scale
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill="black")
    decoded_svg = zxingcpp.read_barcode(svg_raster)
    if not decoded_png or decoded_png.text != args.url or not decoded_svg or decoded_svg.text != args.url:
        raise RuntimeError("Independent QR decoding failed or returned a different URL")

    url_text = html.escape(args.url, quote=True)
    files["print"].write_text(f'''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Global Chain · 扫码探索</title>
<style>
@page{{size:A5 portrait;margin:14mm}}*{{box-sizing:border-box}}body{{margin:0;background:#f3f7f8;color:#173643;font-family:"Segoe UI","Microsoft YaHei",sans-serif}}main{{max-width:148mm;min-height:210mm;margin:0 auto;padding:18mm 13mm 12mm;background:white;text-align:center}}.brand{{font-size:15pt;font-weight:800;letter-spacing:.06em;color:#167b72}}h1{{font-size:25pt;line-height:1.5;margin:10mm 0 3mm}}p{{font-size:12pt;line-height:1.8;color:#49616b;margin:0}}.qr{{max-width:94mm;margin:10mm auto 7mm}}.qr svg{{display:block;width:100%;height:auto}}.url{{display:inline-block;margin:6mm 0 0;font-size:10pt;word-break:break-all;color:#526b74;text-decoration:none}}.line{{margin-top:10mm;padding-top:5mm;border-top:1px solid #dce8e7;font-size:10pt;color:#57716f}}@media print{{body{{background:white}}main{{padding:0;min-height:0;max-width:none}}}}
</style><main><div class="brand">Global Chain</div><h1>一件商品，<br>一个相连的世界。</h1><p>扫码，探索商品背后的世界</p><div class="qr">{svg_text}</div><p>从世界地图，走进中国供应链</p><a class="url" href="{url_text}">{url_text}</a><div class="line">原料 · 制造 · 全球分工</div></main></html>
''', encoding="utf-8", newline="\n")

    inventory = [{"path": file.relative_to(root).as_posix(), "bytes": file.stat().st_size, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()} for key, file in files.items() if key != "verification"]
    verification = {
        "createdAt": datetime.now(timezone(timedelta(hours=8))).isoformat(),
        "target": args.url,
        "http": {"status": status, "finalURL": final_url, "expectedBrandPresent": True},
        "qr": {"version": qr.version, "errorCorrection": "H", "quietZoneModules": 4, "pngPixels": [png.width, png.height], "svgViewBox": parsed_svg.get("viewBox")},
        "independentDecoder": "zxing-cpp",
        "decodedPng": decoded_png.text,
        "decodedSvgRasterizedFromWrittenVector": decoded_svg.text,
        "decodingVerified": True,
        "generatorVersion": importlib.metadata.version("qrcode"),
        "decoderVersion": importlib.metadata.version("zxing-cpp"),
        "files": inventory,
    }
    files["verification"].write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({**verification, "verificationFile": str(files["verification"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
