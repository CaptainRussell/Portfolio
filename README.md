# Cybersecurity Portfolio · Scott D. Russell

One site for my larger cybersecurity projects, written for technical reviewers.

**Live site:** https://captainrussell.github.io/Portfolio/

| Project | Section | Page |
|---|---|---|
| Analysis of a Card-Shuffle Stream Cipher (M.S. Creative Component) | Cybersecurity projects | `projects/daniels-cipher/` |
| Artifact Disagreement Scorer (Digital Forensics, CYBSC 5360) | Cybersecurity projects | `projects/time-sensitive-iot/` | CPR E 5480 (Cyber-Physical Systems Networking, Fall 2025) team project with John Beuter and Nisha Raj: page, `card.webp` (the Cooja mesh, cropped from the project video), the final report and literature study PDFs, `slides/` (the two class briefings, converted from PowerPoint to PDF) and `figures/` (two throughput graphs from the report). `demo/` plays the narrated project video (re-encoded to about 11 MB from the 296 MB original so it fits in the repo; chapter times are in `CHAPTERS` in `demo/index.html`). All four PDFs open in `view/?d=tsiot-*`. |
| `projects/ads/` |
| Internet Secrets (CYBSC 5300 visualization project) | Cybersecurity projects | `projects/internet-secrets/` |
| Time-Sensitive IoT Networks (CPR E 5480 team project, Team One) | Cybersecurity projects | `projects/time-sensitive-iot/` |
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
| `projects/internet-secrets/` | CYBSC 5300 project: page and the proposal PDF (opens in `view/?d=secrets-proposal`). Lessons live in `lessons/<module>/`; update the Status column on the page as each one lands. |
| `projects/internet-secrets/lessons/` | The lesson player, in a cyber palette (dark navy, cyan, green, red) instead of the ISU colors. `index.html` is the lesson picker (the project page links only here) and `complete/` is the final review (8 questions) with the overall score. `shared/lessons.js` lists the lessons, reads and saves scores and gives each quiz its "Next lesson" or "Complete" button (`next` in `Lesson.mount`). `shared/engine.js` is the keyframe animation engine from the cipher slides plus `node` and `packet` kinds, the Card Deck Cipher cast (`person` for Alice and Bob, `eye` for Eve), `keyart`, `blender`, `print` (a fingerprint drawn from a hash) and part title cards (`Anim.addSection`/`Anim.section`); `shared/lesson.js` is the player (caption, Back/Replay/Next, step dots, arrow keys, reduced motion, five-question self-check, 80% to pass, best score in `ihks-lessons-v1`); `shared/lesson.css` is its look. Learner actions: a step's `act(ctx)` shows tap targets, inputs or drag chips and calls `ctx.done(patch)`, which merges the patch into the lesson state and rebuilds the scene. `m1-postcards/` is Lesson 1 (pick and send one of five messages, one tap cuts it, routers choose the path, a jam destroys one postcard and the rest reroute, one tap sorts them, Eve watches every router). `ctx.drag()` makes a piece the learner drags or taps onto a target, and `meta.optional` shows extras without blocking Next. `m2-colors/` is Lesson 2 (Diffie-Hellman with paint, the `can` kind: Alice picks and sends the public color, each side picks a secret on a private side Eve cannot see, every pour and send is a tap, each shared can paints a white key, Alice's key locks a chosen message and Bob's unlocks it; optional math peek). The picker has a Reset progress button. `m3-passwords/` is Lesson 3 (hashing, salt, a crack-it game, crack-time bars): fingerprints are real SHA-256 from a small synchronous function in the page (checked against Web Crypto) drawn with the `print` kind; the learner picks a username and one of three passwords and changes one letter by tapping it. `m4-firewall/` is Lesson 4 (ports, a bouncer with a rule list, three scored firewall rounds where the result steps' captions come from the learner's choices, a sneak attack, a DDoS flood and two defenses); on phones the door switches and signs move under the caption. |
| `projects/ads/` | ADS project page plus the whole former `CaptainRussell/CYBSC5360Project` repo (now private): `tool/` (source, tests, browser edition), `paper/`, `project3/`, drafts, and the tool ZIPs. `downloads/sample_drive.img` is the try-it sample. |

## Adding a project

1. Copy `projects/ads/index.html` or `projects/daniels-cipher/index.html` to `projects/<new-slug>/index.html` and rewrite it. Set the page color with `style="--tone:#hex"` on `<body>`. Keep every path relative.
2. Add one entry to `PROJECTS` in `index.html` (`section` is `security` or `professional`). Keep the blurb to one short sentence, as on Storm HQ.
3. A project with no page here (like the Steam game) can point `href` straight at its own site.
4. Before pushing, check the page at phone width (390 px) and desktop width in both themes. No em dashes in page copy.

## Return button

Every page has one return button: the first item in the top bar, top left, same pill and hover everywhere (`.pf-back` in `shared/portfolio.css`; Storm HQ uses the same placement). It says **All projects** on a project's main page, and names the project on its sub-pages (the ADS browser tool, the cipher slides, and the paper viewer). The hub has none. Never skip a level: on a sub-page every link in the bar (the button and the name) goes to its project page, as on Storm HQ where the whole bar is one link. The bar is always visible (sticky, 42px tall; page toolbars such as the paper viewer's title sit at `top:42px` below it), and the button plus the name are one link (`.pf-up`), so hovering anywhere on it lights up the button.

Papers open in `view/?d=<key>` (pdf.js, in `shared/vendor/pdfjs/`), which has the return button and a Download PDF button. Add a paper to the `DOCS` list in `view/index.html`.

## Old addresses

`CaptainRussell/Creative-Component` was deleted on 2026-11-03, so its old `captainrussell.github.io/Creative-Component/` links no longer work. `CaptainRussell/CYBSC5360Project` is now private, which turns off its GitHub Pages forwarding, so its old links no longer work either. Point anything new at the folders here.

## Publishing the creative component

The slides and paper are built in the private `CPRE5990` repo. Its `Final Report/Defense/presentation/publish_site.py` copies them into `projects/daniels-cipher/` of a local checkout of this repo (by default `Portfolio` next to the CPRE 5990 folder), and `--push` commits and pushes.

## Updating ADS

Work on ADS directly in `projects/ads/` (run its tests from `projects/ads/tool`). When the final paper (December 2026) lands, update the paper link and the "November 2026 draft" wording in `projects/ads/index.html`.
