# Research Paper

`main.tex` is the research paper for this project, written for **Automation in Construction** (Elsevier). `main.pdf` is the compiled output.

## Files

| File                 | Purpose                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `main.tex`           | Paper source, built from Elsevier's `elsarticle-template-num.tex`                         |
| `refs.bib`           | References; every entry resolved from its DOI through Crossref                            |
| `elsarticle.cls`     | Elsevier class v3.4 (2024/04/04), generated unmodified from the official `elsarticle.dtx` |
| `elsarticle-num.bst` | Elsevier numbered reference style (citations numbered in order of first appearance)       |
| `main.pdf`           | Compiled paper                                                                            |

The figures are read directly from `Backend/output/plots/` through `\graphicspath`, so they are not copied here. All numbers in the paper come from `Backend/output/metrics/`, `Backend/output/logs/train.log`, and the backend source.

The template package comes from Elsevier's LaTeX instructions page: <https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions>.

## Build

The build uses [Tectonic](https://tectonic-typesetting.github.io/) 0.17.0, which downloads the LaTeX packages it needs on first run. Install it into this folder (it is Git-ignored) with the official installer script from <https://drop-ps1.fullyjustified.net> (Windows) or <https://drop-sh.fullyjustified.net> (macOS and Linux), then run, from this folder:

```powershell
$env:TECTONIC_CACHE_DIR = "..\..\.cache\tectonic"   # optional: keep the package cache in the repository
.\tectonic.exe --keep-logs --reruns 3 main.tex
```

Expected result: `main.pdf` (23 pages) and `main.log` with no warnings.
