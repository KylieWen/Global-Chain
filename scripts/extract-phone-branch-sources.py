"""Produce reviewable text extracts from immutable public-source files (pypdf required)."""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

from pypdf import PdfReader


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


parser = argparse.ArgumentParser()
parser.add_argument("--only", nargs="*", default=[])
args = parser.parse_args()
directory = Path(__file__).resolve().parents[1] / "data/published/raw/phone-branches-2026-10-21"
for metadata_path in sorted(directory.glob("*.json")):
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("schemaVersion") != "public-source-file-snapshot.v1":
        continue
    if args.only and metadata["key"] not in args.only:
        continue
    source_path = directory / metadata["file"]
    output_path = directory / (metadata["key"] + ".txt")
    digest_path = directory / (metadata["key"] + ".text-sha256")
    raw = source_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != metadata["sha256"]:
        raise ValueError("Raw source hash mismatch: " + metadata["key"])
    if output_path.exists() and digest_path.exists():
        if hashlib.sha256(output_path.read_bytes()).hexdigest() != digest_path.read_text().strip():
            raise ValueError("Existing text extract hash mismatch: " + metadata["key"])
        print(metadata["key"], "retained", flush=True)
        continue
    if source_path.suffix == ".pdf":
        reader = PdfReader(source_path)
        text = "\n".join(f"\nPAGE {index}\n{page.extract_text() or ''}" for index, page in enumerate(reader.pages, 1))
    else:
        try:
            html = raw.decode("utf-8")
        except UnicodeDecodeError:
            html = raw.decode("gb18030", errors="replace")
        extract = VisibleText()
        extract.feed(html)
        text = " ".join(" ".join(extract.parts).split())
    encoded = (text + "\n").encode("utf-8")
    if output_path.exists():
        # Earlier local extracts may already exist; preserve their exact bytes.
        encoded = output_path.read_bytes()
    else:
        output_path.write_bytes(encoded)
    digest_path.write_text(hashlib.sha256(encoded).hexdigest() + "\n", encoding="ascii")
    print(metadata["key"], len(encoded), "extracted bytes", flush=True)
