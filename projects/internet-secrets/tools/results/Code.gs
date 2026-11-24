/**
 * Internet Secrets: anonymous quiz results (CYBSC 5300 final report).
 *
 * Paste this whole file into the Apps Script editor of a new Google Sheet (Extensions > Apps Script),
 * then Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone. Steps: SETUP.md.
 *
 * POST {action:'submit', ...}  one finished quiz from shared/submit.js -> one row in the Responses tab
 * GET  ?action=results         every row (anonymous) + the question text, read by lessons/results/
 *
 * Nothing here can identify a learner: Apps Script never passes the sender's IP address, and the page sends
 * only a random number made in the learner's browser.
 * Code organized with help from Claude (Anthropic).
 */

var LESSONS = { m1: 5, m2: 5, m3: 5, m4: 5, final: 8 };   // lesson id -> number of questions
var MAXQ = 8;
var HEAD = ['Time', 'Learner', 'Group', 'Lesson', 'Try', 'Score', 'Of', 'Passed', 'Minutes', 'Device'];
for (var i = 1; i <= MAXQ; i++) HEAD.push('Q' + i);
for (var j = 1; j <= MAXQ; j++) HEAD.push('Pick' + j);

function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function tab_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Run once from the editor (optional): makes both tabs so the Sheet is ready before the first learner.
function setup() { tab_('Responses', HEAD); tab_('Questions', ['Lesson', 'Question', 'Text', 'Answer']); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.action !== 'submit') return out_({ ok: false, error: 'unknown action' });
    var n = LESSONS[b.lesson];
    if (!n) return out_({ ok: false, error: 'unknown lesson' });
    var learner = String(b.learner || '');
    if (!/^[a-f0-9]{6,16}$/.test(learner)) return out_({ ok: false, error: 'bad learner' });
    learner = 'L-' + learner;   // a letter first, so Sheets never turns a number like 12e45 into a number
    var ans = b.answers, picks = b.picks || [];
    if (!(ans instanceof Array) || ans.length !== n) return out_({ ok: false, error: 'bad answers' });
    for (var k = 0; k < n; k++) if (ans[k] !== 0 && ans[k] !== 1) return out_({ ok: false, error: 'bad answers' });
    var tries = Math.max(1, Math.min(99, parseInt(b.attempt, 10) || 1));
    var group = String(b.group || '').replace(/[^\w-]/g, '').slice(0, 24).toLowerCase();

    var sh = tab_('Responses', HEAD);
    // the same learner, lesson and try only counts once (a double tap, or a retry after a slow network)
    var last = sh.getLastRow();
    if (last > 1) {
      var seen = sh.getRange(2, 2, last - 1, 4).getValues();
      for (var r = seen.length - 1; r >= 0 && r >= seen.length - 2000; r--) {
        if (seen[r][0] === learner && seen[r][2] === b.lesson && Number(seen[r][3]) === tries) return out_({ ok: true, dup: true });
      }
    }
    var score = 0;
    for (k = 0; k < n; k++) score += ans[k];
    var row = [new Date(), learner, group, b.lesson, tries, score, n, score >= Math.ceil(n * 0.8) ? 'yes' : 'no',
      Math.round((Number(b.secs) || 0) / 6) / 10, b.device === 'phone' ? 'phone' : 'computer'];
    for (k = 0; k < MAXQ; k++) row.push(k < n ? ans[k] : '');
    for (k = 0; k < MAXQ; k++) row.push(k < n && picks[k] >= 0 && picks[k] <= 3 ? 'ABCD'.charAt(picks[k]) : '');
    sh.appendRow(row);
    saveQuestions_(b.lesson, n, b.questions, b.key);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Keep one Questions row per lesson question (text and right letter), updated if a question's wording changes.
function saveQuestions_(lesson, n, qs, key) {
  if (!(qs instanceof Array)) return;
  var sh = tab_('Questions', ['Lesson', 'Question', 'Text', 'Answer']), last = sh.getLastRow();
  var have = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
  for (var k = 0; k < n; k++) {
    var text = String(qs[k] || '').slice(0, 300), letter = key && key[k] >= 0 && key[k] <= 3 ? 'ABCD'.charAt(key[k]) : '';
    var at = -1;
    for (var r = 0; r < have.length; r++) if (have[r][0] === lesson && Number(have[r][1]) === k + 1) { at = r; break; }
    if (at < 0) { sh.appendRow([lesson, k + 1, text, letter]); have.push([lesson, k + 1, text, letter]); }
    else if (have[at][2] !== text || have[at][3] !== letter) sh.getRange(at + 2, 3, 1, 2).setValues([[text, letter]]);
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action !== 'results') return out_({ ok: true, note: 'Internet Secrets results endpoint' });
  var sh = tab_('Responses', HEAD), last = sh.getLastRow(), rows = [];
  if (last > 1) {
    rows = sh.getRange(2, 1, last - 1, HEAD.length).getValues().map(function (r) {
      return { t: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), learner: String(r[1]), group: String(r[2]), lesson: r[3], attempt: Number(r[4]),
        score: Number(r[5]), of: Number(r[6]), minutes: Number(r[8]) || 0, device: r[9],
        answers: r.slice(10, 10 + Number(r[6])).map(Number), picks: r.slice(10 + MAXQ, 10 + MAXQ + Number(r[6])).map(String) };
    });
  }
  var qs = tab_('Questions', ['Lesson', 'Question', 'Text', 'Answer']), ql = qs.getLastRow();
  var questions = ql > 1 ? qs.getRange(2, 1, ql - 1, 4).getValues().map(function (r) { return { lesson: r[0], n: Number(r[1]), text: r[2], answer: r[3] }; }) : [];
  return out_({ ok: true, rows: rows, questions: questions });
}
