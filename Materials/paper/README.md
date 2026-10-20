# Research Paper

`main.tex` is the research paper for this project, written for **Automation in Construction** (Elsevier). `main.pdf` is the compiled output.

## Files

| File                 | Purpose                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `main.tex`           | Paper source, built from Elsevier's `elsarticle-template-num.tex`                         |
| `refs.bib`           | References; every entry resolved from its DOI through Crossref                            |
| `elsarticle.cls`     | Elsevier class v3.4 (2024/04/04), generated unmodified from the official `elsarticle.dtx` |
| `elsarticle-num.bst` | Elsevier numbered reference style (citations numbered in order of first appearance)       |
| `compress_pdf.py`    | Post-build step that re-encodes the embedded figures to keep `main.pdf` under 4 MB        |
| `main.pdf`           | Compiled and compressed paper                                                             |

The figures are read directly from `Backend/output/plots/` through `\graphicspath`, so they are not copied here. All numbers in the paper come from `Backend/output/metrics/`, `Backend/output/logs/train.log`, and the backend source.

The template package comes from Elsevier's LaTeX instructions page: <https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions>.

## Build

The build uses [Tectonic](https://tectonic-typesetting.github.io/) 0.17.0, which downloads the LaTeX packages it needs on first run. Install it into this folder (it is Git-ignored) with the official installer script from <https://drop-ps1.fullyjustified.net> (Windows) or <https://drop-sh.fullyjustified.net> (macOS and Linux), then run, from this folder:

```powershell
$env:TECTONIC_CACHE_DIR = "..\..\.cache\tectonic"   # optional: keep the package cache in the repository
.\tectonic.exe --keep-logs --reruns 3 main.tex
..\..\.venv\Scripts\python compress_pdf.py main.pdf main.pdf
```

Expected result: `main.log` with no warnings and a 23-page `main.pdf` of about 3.65 MB.

Tectonic embeds the figure PNGs losslessly, which gives a 9.4 MB PDF. `compress_pdf.py` (needs `pypdf` and `Pillow` in the repository `.venv`) rewrites only the PDF's copies of the images, so the source plots stay unchanged: it flattens transparency onto white, caps each image at 1800 px on the longer side, and stores plots as 256-colour indexed images and photographs as JPEG (quality 85). Text, links and metadata are untouched.
