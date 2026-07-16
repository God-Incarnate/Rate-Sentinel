# Documentation Generators

This project includes three PDF generators for architecture and requirements documentation.

## PDF Generators

| Generator | Output | Files |
|-----------|--------|-------|
| `generate_pdfs.py` | Text-first architecture PDFs | `HLD.pdf`, `LLD.pdf` |
| `generate_diagram_pdfs.py` | Diagram-rich architecture PDFs | `HLD_with_diagrams.pdf`, `LLD_with_diagrams.pdf` |
| `generate_requirements_pdfs.py` | Business & product requirement PDFs | `docs/requirements/BRD.pdf`, `docs/requirements/PRD.pdf` |

## Quick Run All Generators

```powershell
python scripts\generate_pdfs.py
python scripts\generate_diagram_pdfs.py
python scripts\generate_requirements_pdfs.py
```

## Output Organization

**Architecture Documentation (docs/)**
- `HLD.pdf` — High-level design (text)
- `HLD_with_diagrams.pdf` — High-level design (with diagrams)
- `LLD.pdf` — Low-level design (text)
- `LLD_with_diagrams.pdf` — Low-level design (with diagrams)

**Requirements Documentation (docs/requirements/)**
- `rate-sentinel-BRD.md` + `rate-sentinel-BRD.pdf` — Business requirements
- `rate-sentinel-PRD.md` + `rate-sentinel-PRD.pdf` — Product requirements

Markdown and PDF versions are kept together for easy reference.

## Notes

- All generators use only Python standard library (no external dependencies).
- PDFs are automatically paginated and formatted.
- Markdown source files can be edited directly and regenerated anytime.
- See `docs/INDEX.md` for complete documentation index.

