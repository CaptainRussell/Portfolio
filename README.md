# Cybersecurity Portfolio · Scott D. Russell

One site for my larger cybersecurity projects, written for technical reviewers.

**Live site:** https://captainrussell.github.io/Portfolio/

| Project | Section | Page |
|---|---|---|
| Analysis of a Card-Shuffle Stream Cipher (M.S. Creative Component) | Cybersecurity projects | `projects/daniels-cipher/` |
| Artifact Disagreement Scorer (Digital Forensics, CYBSC 5360) | Cybersecurity projects | `projects/ads/` |
| Ashnar's Lair (released on Steam) | Professional projects | links to the Steam store page |
| Storm HQ (AFROTC Det 250 tools) | Professional projects | links to the live site and repo |

## Layout

| Path | What |
|---|---|
| `index.html` | Hub page. `PROFILE` (name, role, contact buttons) and `PROJECTS` (one card each: icon or image, name, blurb, one link) are near the bottom. |
| `shared/portfolio.css` | Storm HQ look: palette (dark default, light kept), top bar, project page parts, footer. |
| `shared/portfolio.js` | Light/dark toggle, remembered per browser (`pf-theme`). |
| `shared/img/` | Header photo and the Det 250 patch used on the Storm HQ card. |
| `projects/daniels-cipher/` | Creative component page, `slides/index.html` (the defense deck) and the paper PDF. Moved here from the old `CaptainRussell/Creative-Component` repo (deleted). |
| `projects/ads/` | ADS project page plus the whole former `CaptainRussell/CYBSC5360Project` repo (now private): `tool/` (source, tests, browser edition), `paper/`, `project3/`, drafts, and the tool ZIPs. `downloads/sample_drive.img` is the try-it sample. |

## Adding a project

1. Copy `projects/ads/index.html` or `projects/daniels-cipher/index.html` to `projects/<new-slug>/index.html` and rewrite it. Set the page color with `style="--tone:#hex"` on `<body>`. Keep every path relative.
2. Add one entry to `PROJECTS` in `index.html` (`section` is `security` or `professional`). Keep the blurb to one short sentence, as on Storm HQ.
3. A project with no page here (like the Steam game) can point `href` straight at its own site.
4. Before pushing, check the page at phone width (390 px) and desktop width in both themes. No em dashes in page copy.

## Return button

Every page has one return button: the first item in the top bar, top left, same pill and hover everywhere (`.pf-back` in `shared/portfolio.css`; Storm HQ uses the same placement). It says **All projects** on a project's main page, and names the project on its sub-pages (the ADS browser tool, the cipher slides, and the paper viewer). The hub has none. Never skip a level: on a sub-page every link in the bar (the button and the name) goes to its project page, as on Storm HQ where the whole bar is one link.

Papers open in `view/?d=<key>` (pdf.js, in `shared/vendor/pdfjs/`), which has the return button and a Download PDF button. Add a paper to the `DOCS` list in `view/index.html`.

## Old addresses

`CaptainRussell/Creative-Component` was deleted on 2026-11-03, so its old `captainrussell.github.io/Creative-Component/` links no longer work. `CaptainRussell/CYBSC5360Project` is now private, which turns off its GitHub Pages forwarding, so its old links no longer work either. Point anything new at the folders here.

## Publishing the creative component

The slides and paper are built in the private `CPRE5990` repo. Its `Final Report/Defense/presentation/publish_site.py` copies them into `projects/daniels-cipher/` of a local checkout of this repo (by default `Portfolio` next to the CPRE 5990 folder), and `--push` commits and pushes.

## Updating ADS

Work on ADS directly in `projects/ads/` (run its tests from `projects/ads/tool`). When the final paper (December 2026) lands, update the paper link and the "November 2026 draft" wording in `projects/ads/index.html`.
