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
| `index.html` | Hub page. `PROFILE` (name, role, contact buttons, focus chips) and `PROJECTS` (one entry per card) are near the bottom. |
| `shared/portfolio.css` | Palette (dark default, light kept), top bar, buttons, chips, project page parts (header, stats, prose, downloads), footer. |
| `shared/portfolio.js` | Light/dark toggle, remembered per browser (`pf-theme`). |
| `projects/<slug>/index.html` | One page per project. |
| `projects/ads/app.html` | The ADS browser edition, copied from CYBSC5360Project. Self-contained and offline. |
| `projects/ads/downloads/` | Tool ZIP, term paper PDF and the sample drive. |
| `tools/sync-ads.sh` | Refreshes the ADS files from a CYBSC5360Project checkout. |

## Adding a project

1. Copy `projects/ads/` or `projects/daniels-cipher/` to `projects/<new-slug>/` and rewrite `index.html`. Set the page color with `style="--tone:#hex"` on `<body>`. Keep every path relative.
2. Add one entry to `PROJECTS` in `index.html` (`section` is `security` or `professional`; add a key to `SECTIONS` for a new group, and an SVG to `ICONS` for a new icon).
3. A project with no page of its own (like the Steam game) can point `href` straight at an external URL with `external: true`.
4. Before pushing, check the page at phone width (390 px) and desktop width in both themes.

## Updating ADS

The source of truth for ADS is `CaptainRussell/CYBSC5360Project`. After changing it there, run:

```
tools/sync-ads.sh ../CYBSC5360Project
```

When the final paper (December 2026) lands, update the PDF name in `tools/sync-ads.sh` and the "November 2026 draft" wording in `projects/ads/index.html`.

The Creative Component paper and slides are linked from their own site (`CaptainRussell/Creative-Component`), not copied here.
