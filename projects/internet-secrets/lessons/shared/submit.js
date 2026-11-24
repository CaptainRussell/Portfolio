/* submit.js: anonymous quiz results for the December tester sessions (CYBSC 5300 final report).
 *
 * Each lesson check saves its answers on this browser. At the end of the final review the score screen offers
 * "Send my answers" (locked on the lesson checks), which sends every lesson at once. It sends only: which
 * lesson, which try on this browser, right (1) or wrong (0) per question, the letter picked, the score, minutes, phone or computer, and a random learner number made in this browser. No name, no
 * account, no email, no IP address (Google Apps Script does not pass one to the script).
 *
 * The answers go to a Google Sheet through a Google Apps Script web app (tools/results/Code.gs). Paste its
 * /exec address into ENDPOINT below. While it is empty the Send box does not show.
 *
 * A link with ?group=<name> (for example ?group=afas3410) tags every send from that browser with the group,
 * so tester sessions can be told apart from other visitors. The results page is lessons/results/.
 * Code organized with help from Claude (Anthropic). */
(function (root) {
  'use strict';
  const ENDPOINT = '';   // Google Apps Script web app address, ending in /exec
  const STORE = 'ihks-learner-v1';   // {id, group, tries: {m1: 2, ...}, quiz: {m1: {first, last}}, sent: {'final#1': true}}

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) { /* private window */ } }
  function me() {
    const o = load();
    if (!o.id) {
      const b = new Uint8Array(5);
      (root.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; });
      o.id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      o.tries = {}; o.sent = {};
      save(o);
    }
    return o;
  }
  // ?group=afas3410 on any lesson link tags this browser (letters, numbers and dashes, up to 24)
  (function () {
    try {
      const g = new URLSearchParams(location.search).get('group');
      if (g != null) { const o = me(); o.group = g.replace(/[^\w-]/g, '').slice(0, 24).toLowerCase(); save(o); }
    } catch (e) { /* old browser */ }
  })();
  // A new learner number (the picker's Reset progress), for a shared classroom computer
  function reset() { try { localStorage.removeItem(STORE); } catch (e) {} }
  // keep(r): save a finished quiz on this browser. The first finish of m1 is try 1, a retake is try 2...
  // Each lesson keeps its first try and its latest try; the final review sends them all at once.
  const ORDER = ['m1', 'm2', 'm3', 'm4', 'final'];
  function keep(r) {
    const o = me(); o.tries = o.tries || {}; o.quiz = o.quiz || {};
    const n = (o.tries[r.lesson] = (o.tries[r.lesson] || 0) + 1);
    const rec = { lesson: r.lesson, attempt: n, score: r.score, of: r.of, secs: Math.round(r.secs || 0), answers: r.answers, picks: r.picks, key: r.key, questions: r.questions };
    const q = (o.quiz[r.lesson] = o.quiz[r.lesson] || {});
    if (n === 1 || !q.first) q.first = rec;
    q.last = rec;
    save(o);
    return n;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const SEND = ic('<path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/>'), CHECK = ic('<path d="m5 12 5 5 9-10"/>'),
    LOCK = ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');

  /* panel(after, r) saves the quiz and puts the Send box after the score card.
   * r = {lesson, answers: [1,0,...], picks: [0..3,...], key: [right index,...], questions: [text,...], score, of, secs}
   * On a lesson check the box is locked: sending opens at the end of the final review, which sends every
   * lesson's first try (and latest try, after a retake) plus the review in one tap. */
  function panel(after, r) {
    const attempt = keep(r);
    if (!ENDPOINT || !after) return;
    const box = document.createElement('div');
    box.className = 'lz-send';
    if (r.lesson !== 'final') {
      box.classList.add('locked');
      box.innerHTML = `<div class="lz-send-txt"><p class="lz-count">Help test these lessons</p>
          <p>Your answers are saved on this device. Send them all at once at the end of the final review.</p></div>
        <button class="lz-btn send" type="button" disabled>${LOCK}<span>Send after the final review</span></button>`;
      after.insertAdjacentElement('afterend', box);
      return;
    }
    const o = me(), tag = 'final#' + attempt;
    const have = ORDER.filter((id) => id !== 'final' && (o.quiz || {})[id]);
    const missing = ORDER.slice(0, 4).filter((id) => !have.includes(id)).map((id) => 'Lesson ' + id.slice(1));
    box.innerHTML = `<div class="lz-send-txt"><p class="lz-count">Help test these lessons</p>
        <p>Send which questions you got right or wrong in every lesson and this review, all at once. No name and no account, just a random number for this browser.</p>
        ${missing.length ? `<p class="lz-send-miss">Not taken yet, so left out: ${missing.join(', ')}.</p>` : ''}</div>
      <button class="lz-btn send" type="button">${SEND}<span>Send my answers</span></button>
      <p class="lz-send-msg" aria-live="polite"></p>`;
    after.insertAdjacentElement('afterend', box);
    const btn = box.querySelector('button'), msg = box.querySelector('.lz-send-msg');
    const sent = () => { box.classList.add('sent'); btn.disabled = true; btn.innerHTML = `${CHECK}<span>Sent</span>`; msg.textContent = 'Thank you. Your answers are in.'; };
    if ((o.sent || {})[tag]) { sent(); return; }
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.querySelector('span').textContent = 'Sending...'; msg.textContent = ''; box.classList.remove('err');
      const p = me(), items = [];
      ORDER.forEach((id) => {
        const q = (p.quiz || {})[id]; if (!q) return;
        items.push(q.first);
        if (q.last && q.last.attempt !== q.first.attempt) items.push(q.last);
      });
      const body = { action: 'submit', v: 2, learner: p.id, group: p.group || '', device: matchMedia('(pointer: coarse)').matches ? 'phone' : 'computer', items };
      let ok = false;
      try {
        // text/plain keeps this a simple request, so the browser does not ask Google for permission first
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const j = await res.json();
        ok = !!(j && j.ok);
      } catch (e) { ok = false; }
      if (ok) { const s = me(); s.sent = s.sent || {}; s.sent[tag] = true; save(s); sent(); }
      else {
        box.classList.add('err'); btn.disabled = false; btn.innerHTML = `${SEND}<span>Try again</span>`;
        msg.textContent = 'That did not go through. Check the internet connection and try again.';
      }
    });
  }
  const plain = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/<[^>]*>/g, '');
  root.Submit = { URL: ENDPOINT, panel, reset, plain, me, esc };
})(this);
