# Research Notes

## Target journal for the research paper (2026-10-20)

**Brief.** Choose a journal for a paper on a YOLO11m PPE detector with a compliance and temporal-confirmation layer for construction sites, with an official, downloadable LaTeX template.

**Scope searched.** Official author pages of Elsevier, PeerJ, and MDPI; Overleaf template listings; journal-metrics aggregators. Searched on 2026-10-20.

**Findings.**

| Journal                               | Scope fit                                                                                                                                                                 | Official LaTeX template                                                                                    | Notes                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Automation in Construction (Elsevier) | Strong: information technology in construction, automated inspection; publishes the closest prior PPE-detection work (Nath et al. 2020, Fang et al. 2018, Wu et al. 2019) | Yes: `elsarticle.zip` linked from Elsevier's LaTeX instructions page, downloaded and used                  | High-impact Q1 journal (impact factor reported as 11.5 to 12.6 by third-party sites, not checked against Clarivate). High novelty bar. |
| PeerJ Computer Science                | Good: venue of the base paper (Ferdous and Ahsan 2022)                                                                                                                    | Yes, but only through Overleaf's "Open as Template" (needs an account), so it could not be downloaded here | Runner-up                                                                                                                              |
| MDPI Buildings / Applied Sciences     | Good                                                                                                                                                                      | Exists on mdpi.com, but mdpi.com returned HTTP 403 to automated requests                                   | Not verified                                                                                                                           |

The Automation in Construction Guide for Authors (abstract, highlight, and keyword limits) could not be opened: sciencedirect.com returned HTTP 400 to automated requests. The paper follows general Elsevier conventions (abstract under 250 words, five highlights under 85 characters, six keywords); check them against the live guide before submission.

**Recommendation.** Automation in Construction, using Elsevier's official `elsarticle` template (class v3.4, 2024/04/04). Runner-up: PeerJ Computer Science, which would suit a version positioned as a computer-science contribution and continues the base paper's venue.

**Sources.**

- Elsevier LaTeX instructions and template package: <https://www.elsevier.com/researcher/author/policies-and-guidelines/latex-instructions>
- PeerJ official Overleaf templates: <https://www.overleaf.com/gallery/tagged/peerj-official>
- MDPI official Overleaf templates: <https://www.overleaf.com/latex/templates/tagged/mdpi>
- Automation in Construction overview: <https://en.wikipedia.org/wiki/Automation_in_Construction>, <https://www.journalmetrics.org/journal/automation-in-construction>, <https://www.bioxbio.com/journal/AUTOMAT-CONSTR>
- Base paper: Ferdous and Ahsan (2022), PeerJ Computer Science 8:e999, <https://doi.org/10.7717/peerj-cs.999>

## Reference verification for the research paper (2026-10-20)

Every entry in `Materials/paper/refs.bib` was resolved by DOI through the Crossref API, and every DOI was confirmed to redirect from doi.org to its publisher. All 24 are peer-reviewed journal articles or conference papers; there are no preprints or books. Descriptions of related work were checked against abstracts where available (Crossref, Frontiers, the AUB repository for Mneymneh et al., the Pictor-PPE repository for Nath et al., and the GDUT-HWD repository for Wu et al.). Park et al. (2015) is described only at the level of its title, because its abstract could not be retrieved. Ultralytics YOLO11 and the Kaggle dataset have no peer-reviewed paper, so they are linked in footnotes rather than cited.
