from pathlib import Path
from textwrap import wrap


PAGE_WIDTH = 595
PAGE_HEIGHT = 842
LEFT_MARGIN = 50
TOP_MARGIN = 790
FONT_SIZE = 11
LEADING = 14
MAX_CHARS = 95


def _escape_pdf_text(value: str) -> str:
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _normalize_markdown_line(line: str) -> str:
    stripped = line.rstrip('\n')
    if stripped.startswith('### '):
        return stripped[4:].upper()
    if stripped.startswith('## '):
        return stripped[3:].upper()
    if stripped.startswith('# '):
        return stripped[2:].upper()
    return stripped


def _paginate_lines(lines):
    page_capacity = int((TOP_MARGIN - 50) / LEADING)
    pages = []
    current = []

    for raw in lines:
        normalized = _normalize_markdown_line(raw)
        if not normalized.strip():
            if len(current) < page_capacity:
                current.append('')
            else:
                pages.append(current)
                current = ['']
            continue

        wrapped = wrap(normalized, width=MAX_CHARS) or ['']
        for segment in wrapped:
            if len(current) >= page_capacity:
                pages.append(current)
                current = []
            current.append(segment)

    if current:
        pages.append(current)

    return pages


def _build_pdf(pages):
    objects = [None]

    def add_obj(content: str) -> int:
        objects.append(content)
        return len(objects) - 1

    catalog_id = add_obj('')
    pages_id = add_obj('')
    font_id = add_obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

    page_ids = []
    for page in pages:
        content_lines = ['BT', f'/F1 {FONT_SIZE} Tf', f'{LEFT_MARGIN} {TOP_MARGIN} Td', f'{LEADING} TL']
        for line in page:
            content_lines.append(f'({_escape_pdf_text(line)}) Tj')
            content_lines.append('T*')
        content_lines.append('ET')
        stream = '\n'.join(content_lines)

        content_id = add_obj(f'<< /Length {len(stream.encode("latin-1", errors="replace"))} >>\nstream\n{stream}\nendstream')
        page_id = add_obj(
            f'<< /Type /Page /Parent {pages_id} 0 R '
            f'/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] '
            f'/Resources << /Font << /F1 {font_id} 0 R >> >> '
            f'/Contents {content_id} 0 R >>'
        )
        page_ids.append(page_id)

    kids = ' '.join([f'{pid} 0 R' for pid in page_ids])
    objects[pages_id] = f'<< /Type /Pages /Count {len(page_ids)} /Kids [{kids}] >>'
    objects[catalog_id] = f'<< /Type /Catalog /Pages {pages_id} 0 R >>'

    output = bytearray()
    output.extend(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')

    offsets = [0] * len(objects)
    for idx in range(1, len(objects)):
        offsets[idx] = len(output)
        output.extend(f'{idx} 0 obj\n{objects[idx]}\nendobj\n'.encode('latin-1', errors='replace'))

    xref_start = len(output)
    output.extend(f'xref\n0 {len(objects)}\n'.encode('ascii'))
    output.extend(b'0000000000 65535 f \n')
    for idx in range(1, len(objects)):
        output.extend(f'{offsets[idx]:010d} 00000 n \n'.encode('ascii'))

    output.extend(
        (
            'trailer\n'
            f'<< /Size {len(objects)} /Root {catalog_id} 0 R >>\n'
            'startxref\n'
            f'{xref_start}\n'
            '%%EOF\n'
        ).encode('ascii')
    )

    return output


def markdown_to_pdf(input_path: Path, output_path: Path):
    lines = input_path.read_text(encoding='utf-8').splitlines()
    pages = _paginate_lines(lines)
    pdf_bytes = _build_pdf(pages)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(pdf_bytes)


if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[1]
    docs_dir = repo_root / 'docs'

    markdown_to_pdf(docs_dir / 'HLD.md', docs_dir / 'HLD.pdf')
    markdown_to_pdf(docs_dir / 'LLD.md', docs_dir / 'LLD.pdf')

    print('Generated docs/HLD.pdf and docs/LLD.pdf')

