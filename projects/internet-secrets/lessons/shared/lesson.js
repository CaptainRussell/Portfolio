/* lesson.js: the lesson player every module shares.
 *
 *   Lesson.mount(document.getElementById('lesson'), {
 *     id: 'm1',                    // short key, used to remember the best quiz score
 *     state: {msg: 'HI'},          // optional: the learner's choices, with defaults
 *     scene: (state) => scene,     // builds the Anim.Scene; each step's meta {head, body} is its caption.
 *                                  // meta.act(ctx) makes it a "your turn" step: build controls with ctx.hit()
 *                                  // (a tap target on the stage), ctx.slot (space under the caption) or ctx.ov
 *                                  // (the stage overlay), then call ctx.done({choices}) to rebuild the scene
 *                                  // with those choices and play the next step. ctx.drag() makes a piece the
 *                                  // learner drags (or taps) onto a target. meta.optional: the controls show but
 *                                  // Next is not blocked (extras such as a math peek).
 *     quiz: [{q, choices: [...], answer: 0, why: 'one sentence'}],   // five questions
 *     pass: 4,                     // correct answers needed (default 4 of 5, 80%)
 *     next: {href, label},         // where the score screen sends the learner: the next lesson, or the final review
 *   });
 *
 * Controls: Next (or the right arrow or Space) plays the next step, and skips to the end of a step that is
 * still playing. Back (left arrow) shows the previous step at rest. Replay (R) plays the current step again.
 * The dots jump to any step. After the last step, Next opens the self-check quiz.
 * Reduced motion: steps appear at rest, with no movement.
 *
 * Template code organized with help from Claude (Anthropic), Nov 2026.
 */
(function (root) {
  'use strict';
  const STORE = 'ihks-lessons-v1';   // {<lesson id>: best score}
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    back: ic('<path d="M15 5l-7 7 7 7"/>'), next: ic('<path d="M9 5l7 7-7 7"/>'),
    replay: ic('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    check: ic('<path d="m5 12 5 5 9-10"/>'), x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  };
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) { /* private window */ } }

  function mount(host, L) {
    // state holds the learner's choices (a typed message, a picked router...). scene(state) is rebuilt after
    // every action, so later steps play out what the learner chose. The step count never depends on state.
    const state = Object.assign({}, L.state || {});
    let sc = L.scene(state);
    const N = sc.steps.length, PASS = L.pass || Math.ceil(L.quiz.length * 0.8);
    host.classList.add('lz');
    host.innerHTML = `
      <div class="lz-view" data-view="watch">
        <div class="lz-stage"><svg class="lz-svg" role="img" aria-label="Lesson animation"></svg><div class="lz-ov"></div></div>
        <div class="lz-cap" aria-live="polite"><p class="lz-count"></p><h2 class="lz-head"></h2><p class="lz-body"></p><div class="lz-act"></div></div>
        <div class="lz-bar">
          <button class="lz-btn" data-act="back">${I.back}<span>Back</span></button>
          <div class="lz-dots" role="group" aria-label="Steps"></div>
          <button class="lz-btn ghost" data-act="replay" title="Replay this step (R)">${I.replay}<span>Replay</span></button>
          <button class="lz-btn go" data-act="next"><span>Next</span>${I.next}</button>
        </div>
      </div>
      <div class="lz-view lz-quiz" data-view="quiz" hidden></div>`;
    const $ = (s) => host.querySelector(s);
    const svg = $('.lz-svg'), dots = $('.lz-dots'), quiz = $('.lz-quiz'), ov = $('.lz-ov'), slot = $('.lz-act');
    dots.innerHTML = sc.steps.map((s, i) => `<button class="lz-dot" data-i="${i}" aria-label="Step ${i + 1}: ${esc(s.meta.head || '')}"><i></i></button>`).join('');
    let player = new root.Anim.Player(svg, sc);
    let step = -1, raf = 0, playing = false, t0 = 0, reached = 0;
    const doneActs = {};
    const pending = () => { const m = sc.steps[step].meta; return !!(m.act && !m.optional && !doneActs[step]); };
    const hasAct = () => { const m = sc.steps[step].meta; return !!(m.act && (m.optional || !doneActs[step])); };

    function paint(frac) {
      dots.querySelectorAll('.lz-dot').forEach((d, i) => {
        d.classList.toggle('done', i < step); d.classList.toggle('cur', i === step);
        d.disabled = i > reached;
        d.firstChild.style.width = (i < step ? 100 : i === step ? frac * 100 : 0) + '%';
        if (i === step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
    }
    function caption() {
      const m = sc.steps[step].meta;
      dots.querySelectorAll('.lz-dot').forEach((d, i) => d.setAttribute('aria-label', `Step ${i + 1}: ${sc.steps[i].meta.head || ''}`));
      $('.lz-count').textContent = `Step ${step + 1} of ${N}`;
      $('.lz-head').innerHTML = rich(m.head || '');
      $('.lz-body').innerHTML = rich(m.body || '');
      $('[data-act="back"]').disabled = step <= 0;
      const nb = $('[data-act="next"]'), wait = pending();
      nb.disabled = wait; nb.classList.toggle('wait', wait);
      nb.querySelector('span').textContent = wait ? 'Your turn' : step === N - 1 ? 'Check yourself' : 'Next';
    }

    // ---- learner actions. A step's meta.act(ctx) builds its controls once the step has finished playing.
    function clearAct() { ov.innerHTML = ''; slot.innerHTML = ''; host.classList.remove('acting'); showAll(); }
    const hidden = new Set();
    function showAll() { hidden.forEach((id) => { const n = player.h[id] && player.h[id]._node; if (n) n.style.visibility = ''; }); hidden.clear(); }
    function startAct() {
      clearAct();
      if (!hasAct()) return;
      if (pending()) host.classList.add('acting');
      const k = step;
      const ctx = {
        state, ov, slot, scene: sc,
        // percent position on the stage for a point in scene units
        pos: (x, y) => ({ left: (x / sc.w * 100) + '%', top: (y / sc.h * 100) + '%' }),
        // a tap target on the stage, centered on (x, y), w by h scene units
        hit(x, y, w, h, label, onTap, cls) {
          const b = document.createElement('button');
          b.className = 'lz-hit' + (cls ? ' ' + cls : '');
          Object.assign(b.style, ctx.pos(x, y), { width: (w / sc.w * 100) + '%', height: (h / sc.h * 100) + '%' });
          b.setAttribute('aria-label', label);
          b.innerHTML = `<span>${esc(label)}</span>`;
          b.addEventListener('click', () => onTap(b));
          ov.appendChild(b); return b;
        },
        // a piece the learner drags onto a target (to = {x, y, r, label}); a plain tap or Enter also drops it,
        // so it works without dragging. color fills the piece. onDrop() runs once.
        drag(x, y, w, h, label, to, onDrop, opt) {
          opt = opt || {};
          const t = document.createElement('div');
          t.className = 'lz-drop';
          Object.assign(t.style, ctx.pos(to.x, to.y), { width: (2 * to.r / sc.w * 100) + '%', height: (2 * to.r / sc.h * 100) + '%' });
          t.innerHTML = `<span>${esc(to.label || 'Drop here')}</span>`;
          ov.appendChild(t);
          const b = ctx.hit(x, y, w, h, label, () => {}, 'lz-src' + (opt.cls ? ' ' + opt.cls : ''));
          if (opt.color) b.style.background = opt.color;
          let sx = 0, sy = 0, bx = 0, by = 0, moved = false, fired = false;
          const near = () => {
            const k = sc.w / ov.clientWidth, cx = b.offsetLeft * k, cy = b.offsetTop * k;
            return Math.hypot(cx - to.x, cy - to.y) < to.r + Math.max(w, h) * 0.35;
          };
          const fire = () => { if (fired) return; fired = true; t.classList.add('over'); b.disabled = true; onDrop(); };
          const home = () => { Object.assign(b.style, ctx.pos(x, y)); };
          b.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; bx = b.offsetLeft; by = b.offsetTop; moved = false; b.setPointerCapture(e.pointerId); });
          b.addEventListener('pointermove', (e) => {
            if (!b.hasPointerCapture(e.pointerId)) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (!moved && Math.hypot(dx, dy) < 6) return;
            moved = true; b.classList.add('drag');
            b.style.left = (bx + dx) + 'px'; b.style.top = (by + dy) + 'px';
            t.classList.toggle('over', near());
          });
          b.addEventListener('pointerup', () => {
            if (!moved) return;
            b.classList.remove('drag'); b.dataset.dragged = '1';
            if (near()) fire(); else { home(); t.classList.remove('over'); }
          });
          b.addEventListener('click', () => { if (b.dataset.dragged) { delete b.dataset.dragged; return; } fire(); });
          return b;
        },
        hide(ids) { ids.forEach((id) => { const n = player.h[id] && player.h[id]._node; if (n) { n.style.visibility = 'hidden'; hidden.add(id); } }); },
        toast(msg) {
          const t = document.createElement('div'); t.className = 'lz-toast'; t.textContent = msg;
          ov.appendChild(t); setTimeout(() => t.remove(), 1600);
        },
        done(patch) {
          if (step !== k) return;
          Object.assign(state, patch || {});
          doneActs[k] = true; clearAct();
          sc = L.scene(state); player = new root.Anim.Player(svg, sc); player.renderEnd(k);
          if (k < N - 1) play(k + 1); else caption();
        },
      };
      sc.steps[k].meta.act(ctx);
      const first = ov.querySelector('button, input') || slot.querySelector('button, input');
      if (first && document.activeElement && host.contains(document.activeElement)) first.focus({ preventScroll: true });
    }

    function finish() { cancelAnimationFrame(raf); playing = false; player.renderEnd(step); paint(1); startAct(); }
    function play(k) {
      cancelAnimationFrame(raf); clearAct();
      step = k; reached = Math.max(reached, k); caption();
      if (reduce()) { finish(); return; }
      const dur = sc.duration(k);
      playing = true; t0 = performance.now(); paint(0);
      const tick = (now) => {
        const t = (now - t0) / 1000;
        if (t >= dur) { finish(); return; }
        player.render(step, t); paint(t / dur); raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function rest(k) { cancelAnimationFrame(raf); playing = false; clearAct(); step = k; caption(); player.renderEnd(k); paint(1); startAct(); }
    function next() {
      if (playing) { finish(); return; }
      if (pending()) return;
      if (step < N - 1) play(step + 1); else openQuiz();
    }
    function back() { if (playing) finish(); if (step > 0) rest(step - 1); }

    host.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !host.contains(b)) return;
      if (b.dataset.act === 'next') next();
      else if (b.dataset.act === 'back') back();
      else if (b.dataset.act === 'replay') play(step);
      else if (b.classList.contains('lz-dot')) { const i = +b.dataset.i; if (i > reached) return; if (i === 0) { player.renderBase(); play(0); } else { rest(i - 1); play(i); } }
    });
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || !quiz.hidden) return;
      const onCtl = e.target.closest && e.target.closest('button, a, input, textarea');
      const typing = e.target.closest && e.target.closest('input, textarea');
      if (typing) return;
      if (e.key === 'ArrowRight' || (e.key === ' ' && !onCtl)) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if ((e.key === 'r' || e.key === 'R') && !onCtl) play(step);
    });

    // A cyan scan line sweeps the stage when the view changes (the slides' section sweep, recolored).
    function swap(show) {
      host.querySelectorAll('.lz-view').forEach((v) => { v.hidden = v.dataset.view !== show; });
      if (!reduce()) { host.classList.remove('swept'); void host.offsetWidth; host.classList.add('swept'); }
      host.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
    }

    // ------------------------------------------------------------ quiz
    let qi = 0, right = 0;
    function openQuiz() { qi = 0; right = 0; quiz.classList.remove('scored'); swap('quiz'); ask(); }
    function ask() {
      const Q = L.quiz[qi];
      quiz.innerHTML = `
        <p class="lz-count">Check yourself · Question ${qi + 1} of ${L.quiz.length}</p>
        <div class="lz-qbar" aria-hidden="true">${L.quiz.map((_, i) => `<i class="${i < qi ? 'done' : i === qi ? 'cur' : ''}"></i>`).join('')}</div>
        <h2 class="lz-q" tabindex="-1">${rich(Q.q)}</h2>
        <div class="lz-choices">${Q.choices.map((c, i) => `<button class="lz-choice" data-c="${i}"><span class="lz-key">${'ABCD'[i]}</span><span>${rich(c)}</span></button>`).join('')}</div>
        <div class="lz-why" aria-live="polite"></div>`;
      quiz.querySelector('.lz-q').focus({ preventScroll: true });
      quiz.querySelectorAll('.lz-choice').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.c)));
    }
    function pick(c) {
      const Q = L.quiz[qi], ok = c === Q.answer;
      if (ok) right++;
      quiz.querySelectorAll('.lz-choice').forEach((b, i) => {
        b.disabled = true;
        if (i === Q.answer) { b.classList.add('right'); b.querySelector('.lz-key').innerHTML = I.check; }
        else if (i === c) { b.classList.add('wrong'); b.querySelector('.lz-key').innerHTML = I.x; }
      });
      const last = qi === L.quiz.length - 1;
      quiz.querySelector('.lz-why').innerHTML = `<p class="${ok ? 'ok' : 'no'}"><b>${ok ? 'Correct.' : 'Not quite.'}</b> ${rich(Q.why || '')}</p>
        <button class="lz-btn go" data-q="next"><span>${last ? 'See my score' : 'Next question'}</span>${I.next}</button>`;
      const nb = quiz.querySelector('[data-q="next"]');
      nb.addEventListener('click', () => { if (last) score(); else { qi++; ask(); } });
      nb.focus({ preventScroll: true });
    }
    function score() {
      const best = load(), pass = right >= PASS;
      if (!(best[L.id] >= right)) { best[L.id] = right; save(best); }
      quiz.classList.add('scored');
      quiz.innerHTML = `
        <div class="lz-score ${pass ? 'pass' : 'retry'}">
          <div class="lz-ring" style="--p:${right / L.quiz.length}"><b>${right}/${L.quiz.length}</b></div>
          <div><p class="lz-count">Check yourself · Score</p>
          <h2 tabindex="-1">${pass ? 'Objective met' : 'Almost there'}</h2>
          <p class="lz-body">${pass ? `You got ${right} of ${L.quiz.length} right. ${right === L.quiz.length ? 'A perfect score.' : `${PASS} or more meets the goal.`}`
            : `You got ${right} of ${L.quiz.length}. ${PASS} or more meets the goal. Replay the lesson and try again.`}</p>
          <p class="lz-best">Best score on this device: ${load()[L.id]}/${L.quiz.length}</p></div>
        </div>
        <div class="lz-bar end">
          <button class="lz-btn" data-q="watch">${I.replay}<span>Watch again</span></button>
          <button class="lz-btn ${L.next ? 'ghost' : 'go'}" data-q="retake"><span>Retake quiz</span></button>
          ${L.next ? `<a class="lz-btn go" href="${esc(L.next.href)}"><span>${esc(L.next.label)}</span>${I.next}</a>` : ''}
        </div>`;
      quiz.querySelector('h2').focus({ preventScroll: true });
      quiz.querySelector('[data-q="watch"]').addEventListener('click', () => { swap('watch'); rest(0); });
      quiz.querySelector('[data-q="retake"]').addEventListener('click', openQuiz);
    }

    player.renderBase();
    play(0);
  }
  root.Lesson = { mount };
})(this);
