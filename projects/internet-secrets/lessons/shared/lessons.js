/* lessons.js: the four lessons in order, shared by the lesson picker, each lesson's "next" button and the final review.
 * Scores live in localStorage 'ihks-lessons-v1' as {m1: best of 5, ..., final: best of 8}. */
(function (root) {
  'use strict';
  const LIST = [
    { id: 'm1', href: 'm1-postcards/', n: 1, name: 'Postcards on the internet', blurb: 'Send Bob a message, piece by piece, across a map of routers, and see who can read it.' },
    { id: 'm2', href: 'm2-colors/', n: 2, name: 'Mixing secret colors', blurb: 'Make a secret with Bob using paint while Eve watches, then paint a key and lock a message.' },
    { id: 'm3', href: 'm3-passwords/', n: 3, name: 'Crack the password', blurb: 'See the fingerprint a website keeps instead of your password, then play the thief.' },
    { id: 'm4', href: 'm4-firewall/', n: 4, name: 'Guard the gate', blurb: 'Run the firewall for three rounds of visitors, then face a flood.' },
  ];
  const STORE = 'ihks-lessons-v1';
  function scores() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) { /* private window */ } }
  // The score screen's main button: the next lesson, or the final review after Lesson 4. Paths are relative to a lesson.
  function next(id) {
    const i = LIST.findIndex((l) => l.id === id);
    if (i < LIST.length - 1) return { href: '../' + LIST[i + 1].href, label: `Next lesson: ${LIST[i + 1].name}` };
    return { href: '../complete/', label: 'Complete: final review' };
  }
  root.Lessons = { LIST, STORE, scores, save, next };
})(this);
