# Internet Secrets

CYBSC 5300 (Network Security, Iowa State University, Fall 2026) visualization project by Capt Scott D. Russell.

Four short animated, interactive lessons that teach how the internet moves and protects information, written at a high school level for learners with no networking background. Each lesson ends with a five-question self-check (4 of 5 to pass), and a final review gives an overall score.

**Live:** https://captainrussell.github.io/Portfolio/projects/internet-secrets/lessons/

| Lesson | Folder | Topic | TCP/IP layer |
|---|---|---|---|
| 1. Postcards on the Internet | `lessons/m1-postcards/` | Packets, routing, lost packets, reassembly, eavesdropping | Network (IP routing), transport (sequence numbers, resend), link (café Wi-Fi) |
| 2. Mixing Secret Colors | `lessons/m2-colors/` | Diffie-Hellman key exchange with paint, locking a message, HTTPS padlock; optional math peek (3, 17, mod) | Between transport and application (TLS) |
| 3. Crack the Password | `lessons/m3-passwords/` | Plain vs hashed storage, real SHA-256 fingerprints, one-letter change, salt, guessing attack, crack time | Application (login and server storage) |
| 4. The Fire Wall | `lessons/m4-firewall/` | Firewall as a wall, default deny, ports as numbered gates (25 email, 22 remote control) | Transport (port numbers) checked at the network edge |
| Final review | `lessons/complete/` | 8 big-idea questions, overall score | |

## Run it

No install, build step, server or account is needed.

- Online: open the live link above in any modern browser (Chrome, Edge, Firefox or Safari, desktop or phone).
- Offline: clone the repo, then from the repo root run `python3 -m http.server 8000` and open `http://localhost:8000/projects/internet-secrets/lessons/`. Opening the HTML files directly from disk also works in most browsers.

Progress (best quiz score per lesson) is saved only in the learner's own browser (`localStorage` key `ihks-lessons-v1`). The picker's Reset progress button clears it.

## Files

| Path | What |
|---|---|
| `index.html` | Project page on the portfolio. |
| `lessons/index.html` | Lesson picker. |
| `lessons/shared/engine.js` | Keyframe animation engine and SVG renderer (carried over from my CPRE 5990 defense slides), with the networking object kinds: `node`, `packet`, `person`, `eye`, `can`, `keyart`, `blender`, `print`. |
| `lessons/shared/lesson.js` | Lesson player: caption, Back/Replay/Next, step dots, keyboard, reduced motion, learner actions (`act(ctx)`), and the quiz. |
| `lessons/shared/lessons.js` | Lesson list, saved scores, next-lesson links. |
| `lessons/shared/lesson.css` | Player look (cyber palette, always dark). |
| `lessons/m*/index.html` | One lesson each: scene, steps, learner actions and quiz. |
| `lessons/complete/index.html` | Final review. |

## Dependencies

None. Plain HTML, CSS, JavaScript and SVG, with no frameworks, libraries, server or database. Lesson 3 computes SHA-256 with a small function in the page. The project page uses the portfolio's shared `shared/portfolio.css` and `shared/portfolio.js`.

## Sources and credits

Content sources are listed in the project's Research and Content Development submission and its proposal (`CYBSC 5300 Project Proposal - Russell.pdf`). Code was organized with help from Claude (Anthropic); each file notes this in its header comment. All drawings are generated SVG.
