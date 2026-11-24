/* submit.js: anonymous quiz results for the December tester sessions (CYBSC 5300 final report).
 *
 * After a lesson check or the final review, the score screen offers "Send my answers". It sends only:
 * which lesson, which try on this browser, right (1) or wrong (0) per question, the letter picked, the score,
 * minutes in the lesson, phone or computer, and a random learner number made in this browser. No name, no
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
  const STORE = 'ihks-learner-v1';   // {id, group, tries: {m1: 2, ...}, sent: {'m1#2': true}}

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
  // Count a finished quiz: the first finish of m1 on this browser is try 1, a retake is try 2...
  function count(lesson) { const o = me(); o.tries = o.tries || {}; o.tries[lesson] = (o.tries[lesson] || 0) + 1; save(o); return o.tries[lesson]; }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const SEND = ic('<path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 9-9"/>'), CHECK = ic('<path d="m5 12 5 5 9-10"/>');

  /* panel(after, r) puts the Send box after the score card. r = {lesson, attempt, answers: [1,0,...],
   * picks: [0..3,...], key: [right index,...], questions: [text,...], score, of, pass, secs} */
  function panel(after, r) {
    if (!ENDPOINT || !after) return;
    const o = me(), tag = r.lesson + '#' + r.attempt;
    const box = document.createElement('div');
    box.className = 'lz-send';
    box.innerHTML = `<div class="lz-send-txt"><p class="lz-count">Help test these lessons</p>
        <p>Send which questions you got right or wrong. No name and no account, just a random number for this browser.</p></div>
      <button class="lz-btn send" type="button">${SEND}<span>Send my answers</span></button>
      <p class="lz-send-msg" aria-live="polite"></p>`;
    after.insertAdjacentElement('afterend', box);
    const btn = box.querySelector('button'), msg = box.querySelector('.lz-send-msg');
    const sent = () => { box.classList.add('sent'); btn.disabled = true; btn.innerHTML = `${CHECK}<span>Sent</span>`; msg.textContent = 'Thank you. Your answers are in.'; };
    if ((o.sent || {})[tag]) { sent(); return; }
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.querySelector('span').textContent = 'Sending...'; msg.textContent = ''; box.classList.remove('err');
      const body = {
        action: 'submit', v: 1, learner: o.id, group: o.group || '', lesson: r.lesson, attempt: r.attempt,
        score: r.score, of: r.of, pass: !!r.pass, secs: Math.round(r.secs || 0), answers: r.answers, picks: r.picks,
        key: r.key, questions: r.questions, device: matchMedia('(pointer: coarse)').matches ? 'phone' : 'computer',
      };
      let ok = false;
      try {
        // text/plain keeps this a simple request, so the browser does not ask Google for permission first
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
        const j = await res.json();
        ok = !!(j && (j.ok || j.dup));
      } catch (e) { ok = false; }
      if (ok) { const p = me(); p.sent = p.sent || {}; p.sent[tag] = true; save(p); sent(); }
      else {
        box.classList.add('err'); btn.disabled = false; btn.innerHTML = `${SEND}<span>Try again</span>`;
        msg.textContent = 'That did not go through. Check the internet connection and try again.';
      }
    });
  }
  const plain = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/<[^>]*>/g, '');
  root.Submit = { URL: ENDPOINT, panel, count, reset, plain, me, esc };
})(this);
