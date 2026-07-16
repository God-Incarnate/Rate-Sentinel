from pathlib import Path
from textwrap import wrap

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
FONT_SIZE = 11
LEADING = 14
LEFT_MARGIN = 48
TOP_TEXT_Y = 790
TEXT_MAX_CHARS = 92


class SimplePdfBuilder:
    def __init__(self):
        self.objects = [None]
        self.catalog_id = self._add_obj("")
        self.pages_id = self._add_obj("")
        self.font_id = self._add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        self.bold_font_id = self._add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
        self.page_ids = []

    def _add_obj(self, content: str) -> int:
        self.objects.append(content)
        return len(self.objects) - 1

    @staticmethod
    def _escape(text: str) -> str:
        return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    def add_text_page(self, lines):
        commands = ["BT"]
        y = TOP_TEXT_Y
        for raw in lines:
            line = raw.rstrip("\n")
            if not line.strip():
                y -= LEADING
                continue

            # Detect heading levels
            if line.startswith("# "):
                # H1 - use bold, larger
                text = line[2:].strip()
                commands.append(f"/F1 16 Tf")
                commands.append(f"{LEFT_MARGIN} {y} Td")
                commands.append(f"({self._escape(text)}) Tj")
                y -= 20
            elif line.startswith("## "):
                # H2 - use bold
                text = line[3:].strip()
                commands.append(f"/F1 13 Tf")
                commands.append(f"{LEFT_MARGIN} {y} Td")
                commands.append(f"({self._escape(text)}) Tj")
                y -= 18
            elif line.startswith("### "):
                # H3 - smaller bold
                text = line[4:].strip()
                commands.append(f"/F1 12 Tf")
                commands.append(f"{LEFT_MARGIN} {y} Td")
                commands.append(f"({self._escape(text)}) Tj")
                y -= 15
            else:
                # Regular text with wrapping
                commands.append(f"/F1 {FONT_SIZE} Tf")
                commands.append(f"{LEFT_MARGIN} {y} Td")
                wrapped = wrap(line, width=TEXT_MAX_CHARS) or [""]
                for segment in wrapped:
                    commands.append(f"({self._escape(segment)}) Tj")
                    y -= LEADING
                y -= 2

            if y < 50:
                commands.append("ET")
                self._add_page_from_commands(commands)
                commands = ["BT"]
                y = TOP_TEXT_Y

        commands.append("ET")
        if len(commands) > 1:
            self._add_page_from_commands(commands)

    def _add_page_from_commands(self, draw_commands):
        stream = " ".join([str(cmd) for cmd in draw_commands])
        length = len(stream.encode("latin-1", errors="replace"))
        content_id = self._add_obj(f"<< /Length {length} >>\nstream\n{stream}\nendstream")
        page_id = self._add_obj(
            f"<< /Type /Page /Parent {self.pages_id} 0 R "
            f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {self.font_id} 0 R /FB {self.bold_font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        )
        self.page_ids.append(page_id)

    def save(self, output_path: Path):
        kids = " ".join([f"{pid} 0 R" for pid in self.page_ids])
        self.objects[self.pages_id] = f"<< /Type /Pages /Count {len(self.page_ids)} /Kids [{kids}] >>"
        self.objects[self.catalog_id] = f"<< /Type /Catalog /Pages {self.pages_id} 0 R >>"

        output = bytearray()
        output.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

        offsets = [0] * len(self.objects)
        for idx in range(1, len(self.objects)):
            offsets[idx] = len(output)
            output.extend(f"{idx} 0 obj\n{self.objects[idx]}\nendobj\n".encode("latin-1", errors="replace"))

        xref_start = len(output)
        output.extend(f"xref\n0 {len(self.objects)}\n".encode("ascii"))
        output.extend(b"0000000000 65535 f \n")
        for idx in range(1, len(self.objects)):
            output.extend(f"{offsets[idx]:010d} 00000 n \n".encode("ascii"))

        output.extend(
            (
                "trailer\n"
                f"<< /Size {len(self.objects)} /Root {self.catalog_id} 0 R >>\n"
                "startxref\n"
                f"{xref_start}\n"
                "%%EOF\n"
            ).encode("ascii")
        )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(output)


def markdown_to_pdf(input_path: Path, output_path: Path):
    """Convert markdown file to PDF."""
    if not input_path.exists():
        print(f"File not found: {input_path}")
        return

    lines = input_path.read_text(encoding='utf-8').splitlines()
    doc = SimplePdfBuilder()
    doc.add_text_page(lines)
    doc.save(output_path)
    print(f"Generated: {output_path}")


def main():
    repo_root = Path(__file__).resolve().parents[1]

    # Create requirements folder structure
    requirements_dir = repo_root / "docs" / "requirements"
    requirements_dir.mkdir(parents=True, exist_ok=True)

    # Convert BRD
    brd_md = repo_root / "rate-sentinel-BRD.md"
    brd_pdf = requirements_dir / "rate-sentinel-BRD.pdf"
    markdown_to_pdf(brd_md, brd_pdf)

    # Copy markdown to requirements folder for organization
    brd_copy = requirements_dir / "rate-sentinel-BRD.md"
    if brd_md.exists():
        brd_copy.write_text(brd_md.read_text(encoding='utf-8'), encoding='utf-8')
        print(f"Copied: {brd_copy}")

    # Convert PRD
    prd_md = repo_root / "rate-sentinel-PRD.md"
    prd_pdf = requirements_dir / "rate-sentinel-PRD.pdf"
    markdown_to_pdf(prd_md, prd_pdf)

    # Copy markdown to requirements folder for organization
    prd_copy = requirements_dir / "rate-sentinel-PRD.md"
    if prd_md.exists():
        prd_copy.write_text(prd_md.read_text(encoding='utf-8'), encoding='utf-8')
        print(f"Copied: {prd_copy}")

    print(f"\nAll files organized in: {requirements_dir}")
    print(f"├── rate-sentinel-BRD.md")
    print(f"├── rate-sentinel-BRD.pdf")
    print(f"├── rate-sentinel-PRD.md")
    print(f"└── rate-sentinel-PRD.pdf")


if __name__ == "__main__":
    main()

