/* lesson.js: the lesson player every module shares.
 *
 *   Lesson.mount(document.getElementById('lesson'), {
 *     id: 'm1',                    // short key, used to remember the best quiz score
 *     scene: () => scene,          // builds the Anim.Scene; each step's meta {head, body} is its caption
 *     quiz: [{q, choices: [...], answer: 0, why: 'one sentence'}],   // five questions
 *     pass: 4,                     // correct answers needed (default 4 of 5, 80%)
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
    const sc = L.scene(), N = sc.steps.length, PASS = L.pass || Math.ceil(L.quiz.length * 0.8);
    host.classList.add('lz');
    host.innerHTML = `
      <div class="lz-view" data-view="watch">
        <div class="lz-stage"><svg class="lz-svg" role="img" aria-label="Lesson animation"></svg></div>
        <div class="lz-cap" aria-live="polite"><p class="lz-count"></p><h2 class="lz-head"></h2><p class="lz-body"></p></div>
        <div class="lz-bar">
          <button class="lz-btn" data-act="back">${I.back}<span>Back</span></button>
          <div class="lz-dots" role="group" aria-label="Steps"></div>
          <button class="lz-btn ghost" data-act="replay" title="Replay this step (R)">${I.replay}<span>Replay</span></button>
          <button class="lz-btn go" data-act="next"><span>Next</span>${I.next}</button>
        </div>
      </div>
      <div class="lz-view lz-quiz" data-view="quiz" hidden></div>`;
    const $ = (s) => host.querySelector(s);
    const svg = $('.lz-svg'), dots = $('.lz-dots'), quiz = $('.lz-quiz');
    dots.innerHTML = sc.steps.map((s, i) => `<button class="lz-dot" data-i="${i}" aria-label="Step ${i + 1}: ${esc(s.meta.head || '')}"><i></i></button>`).join('');
    const player = new root.Anim.Player(svg, sc);
    let step = -1, raf = 0, playing = false, t0 = 0;

    function paint(frac) {
      dots.querySelectorAll('.lz-dot').forEach((d, i) => {
        d.classList.toggle('done', i < step); d.classList.toggle('cur', i === step);
        d.firstChild.style.width = (i < step ? 100 : i === step ? frac * 100 : 0) + '%';
        if (i === step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
    }
    function caption() {
      const m = sc.steps[step].meta;
      $('.lz-count').textContent = `Step ${step + 1} of ${N}`;
      $('.lz-head').innerHTML = rich(m.head || '');
      $('.lz-body').innerHTML = rich(m.body || '');
      $('[data-act="back"]').disabled = step <= 0;
      $('[data-act="next"] span').textContent = step === N - 1 ? 'Check yourself' : 'Next';
    }
    function finish() { cancelAnimationFrame(raf); playing = false; player.renderEnd(step); paint(1); }
    function play(k) {
      cancelAnimationFrame(raf);
      step = k; caption();
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
    function rest(k) { cancelAnimationFrame(raf); playing = false; step = k; caption(); player.renderEnd(k); paint(1); }
    function next() {
      if (playing) { finish(); return; }
      if (step < N - 1) play(step + 1); else openQuiz();
    }
    function back() { if (playing) finish(); if (step > 0) rest(step - 1); }

    host.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !host.contains(b)) return;
      if (b.dataset.act === 'next') next();
      else if (b.dataset.act === 'back') back();
      else if (b.dataset.act === 'replay') play(step);
      else if (b.classList.contains('lz-dot')) { const i = +b.dataset.i; if (i === 0) { player.renderBase(); play(0); } else { rest(i - 1); play(i); } }
    });
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || !quiz.hidden) return;
      const onBtn = e.target.closest && e.target.closest('button, a, input, textarea');
      if (e.key === 'ArrowRight' || (e.key === ' ' && !onBtn)) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if ((e.key === 'r' || e.key === 'R') && !onBtn) play(step);
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
          <button class="lz-btn go" data-q="retake"><span>Retake quiz</span>${I.next}</button>
        </div>`;
      quiz.querySelector('h2').focus({ preventScroll: true });
      quiz.querySelector('[data-q="watch"]').addEventListener('click', () => { swap('watch'); player.renderBase(); play(0); });
      quiz.querySelector('[data-q="retake"]').addEventListener('click', openQuiz);
    }

    player.renderBase();
    play(0);
  }
  root.Lesson = { mount };
})(this);
