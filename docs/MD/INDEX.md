# Rate-Sentinel Documentation Index

## Overview

This directory contains comprehensive documentation for the rate-sentinel project organized into the following categories:

## Architecture & Design (Docs Root)

| File | Purpose |
|------|---------|
| `HLD.md` | High-level design - text-focused architecture document |
| `HLD.pdf` | HLD in PDF format |
| `HLD_with_diagrams.pdf` | HLD with visual system context, container, and sequence diagrams |
| `LLD.md` | Low-level design - detailed module and component specs |
| `LLD.pdf` | LLD in PDF format |
| `LLD_with_diagrams.pdf` | LLD with OTP flow, payment state, and rule evaluation diagrams |

## Requirements (Docs/Requirements)

Located in `requirements/` subfolder:

| File | Purpose |
|------|---------|
| `rate-sentinel-BRD.md` | Business requirements document - business goals, problems, KPIs |
| `rate-sentinel-BRD.pdf` | BRD in PDF format |
| `rate-sentinel-PRD.md` | Product requirements document - functional specs, APIs, data models |
| `rate-sentinel-PRD.pdf` | PRD in PDF format |

Both markdown and PDF versions are kept together for easy reference and version control.

## Organization Strategy

- **Markdown files** are version-controlled in git and easily editable.
- **PDF files** are generated from markdown for distribution and structured documentation.
- **Architecture docs** (HLD/LLD) are organized in the main `docs/` folder.
- **Requirement docs** (BRD/PRD) are organized together in `docs/requirements/` for clarity.

## Generating PDFs

Three generator scripts automate PDF creation from markdown:

```powershell
# Generate HLD and LLD text-based PDFs
python scripts\generate_pdfs.py

# Generate HLD and LLD with architecture diagrams
python scripts\generate_diagram_pdfs.py

# Generate BRD and PRD PDFs
python scripts\generate_requirements_pdfs.py
```

All generators use only Python standard library — no external dependencies required.

## Quick Access

All PDFs and markdown files are ready to use immediately. Choose your format based on needs:

- **For review/sharing:** Use PDF files (self-contained, no dependencies)
- **For editing:** Use markdown files (git-friendly, lightweight)
- **For visual understanding:** Use `*_with_diagrams.pdf` files

