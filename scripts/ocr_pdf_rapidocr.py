#!/usr/bin/env python3
"""
OCR a scanned PDF into per-page text and a combined text file using:
- pypdfium2 for PDF rendering
- RapidOCR for Chinese/English OCR

This script is designed for large, image-based PDFs like the locally downloaded
"大道：段永平投..25.pdf".
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from time import perf_counter

import pypdfium2 as pdfium
from rapidocr import RapidOCR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OCR a scanned PDF with RapidOCR.")
    parser.add_argument("--input", required=True, help="Input PDF path")
    parser.add_argument(
        "--output-dir",
        default="source-materials/notes/pdf-ocr-rapidocr",
        help="Directory for OCR output",
    )
    parser.add_argument("--start-page", type=int, default=1, help="1-based start page")
    parser.add_argument("--end-page", type=int, help="1-based end page, inclusive")
    parser.add_argument(
        "--scale",
        type=float,
        default=2.0,
        help="Render scale, 2.0 is usually a good balance",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip page OCR if the per-page txt already exists",
    )
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def render_page(doc: pdfium.PdfDocument, page_index: int, scale: float):
    page = doc[page_index]
    bitmap = page.render(scale=scale)
    return bitmap.to_pil()


def extract_text(ocr_engine: RapidOCR, pil_image) -> tuple[str, int]:
    output = ocr_engine(pil_image)
    items = []
    boxes = output.boxes if output.boxes is not None else []
    texts = output.txts if output.txts is not None else []

    for box, text in zip(boxes, texts):
        if not text:
            continue
        min_x = min(point[0] for point in box)
        min_y = min(point[1] for point in box)
        items.append((float(min_y), float(min_x), text.strip()))

    items.sort(key=lambda row: (round(row[0] / 12), row[1]))
    lines = [text for _, _, text in items if text]
    return "\n".join(lines).strip(), len(lines)


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    pages_dir = output_dir / "pages"

    ensure_dir(output_dir)
    ensure_dir(pages_dir)

    doc = pdfium.PdfDocument(str(input_path))
    total_pages = len(doc)

    start_page = max(args.start_page, 1)
    end_page = min(args.end_page or total_pages, total_pages)
    if start_page > end_page:
        raise SystemExit("Invalid page range")

    ocr_engine = RapidOCR()
    summary_pages = []
    combined_parts = []

    for page_number in range(start_page, end_page + 1):
        page_index = page_number - 1
        page_txt_path = pages_dir / f"{page_number:04d}.txt"

        if args.skip_existing and page_txt_path.exists():
            text = page_txt_path.read_text(encoding="utf-8")
            text_body = text.split("\n", 1)[1] if "\n" in text else text
            combined_parts.append(text.rstrip() + "\n")
            summary_pages.append(
                {
                    "page": page_number,
                    "characters": len(text_body),
                    "lines": text_body.count("\n") + (1 if text_body.strip() else 0),
                    "skipped": True,
                }
            )
            print(f"[skip] page {page_number}/{total_pages}")
            continue

        start = perf_counter()
        image = render_page(doc, page_index, args.scale)
        text, line_count = extract_text(ocr_engine, image)
        elapsed = perf_counter() - start

        page_output = f"===== Page {page_number} =====\n{text}\n"
        page_txt_path.write_text(page_output, encoding="utf-8")
        combined_parts.append(page_output + "\n")

        summary_pages.append(
            {
                "page": page_number,
                "characters": len(text),
                "lines": line_count,
                "elapsed_sec": round(elapsed, 3),
            }
        )
        print(
            f"[ocr] page {page_number}/{total_pages} "
            f"chars={len(text)} lines={line_count} sec={elapsed:.2f}"
        )

    combined_path = output_dir / "combined.txt"
    combined_path.write_text("".join(combined_parts), encoding="utf-8")

    summary = {
        "input": str(input_path.resolve()),
        "output_dir": str(output_dir.resolve()),
        "start_page": start_page,
        "end_page": end_page,
        "total_pages": total_pages,
        "scale": args.scale,
        "pages": summary_pages,
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"[done] combined text: {combined_path}")
    print(f"[done] summary: {output_dir / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
