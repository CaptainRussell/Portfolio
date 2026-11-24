/**
 * Internet Secrets: anonymous quiz results (CYBSC 5300 final report).
 *
 * Paste this whole file into the Apps Script editor of a new Google Sheet (Extensions > Apps Script),
 * then Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone. Steps: SETUP.md.
 *
 * POST {action:'submit', learner, group, device, items:[...]}  sent once from the final review by shared/submit.js:
 *      each lesson's first try (and latest try after a retake) plus the review -> one row per quiz in the Responses tab
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

// The results Sheet: the Sheet this script was made from (Extensions > Apps Script), or, for a script made on
// its own at script.google.com, a Sheet named "Internet Secrets results" that it makes in your Drive the first
// time it runs (its id is kept in Project Settings > Script Properties as SHEET_ID).
function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('Internet Secrets results');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function tab_(name, head) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Run once from the editor (optional): makes both tabs so the Sheet is ready before the first learner.
// The log (View > Logs, or the Execution log) shows the Sheet's address.
function setup() { tab_('Responses', HEAD); tab_('Questions', ['Lesson', 'Question', 'Text', 'Answer']); Logger.log('Results Sheet: ' + ss_().getUrl()); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.action !== 'submit') return out_({ ok: false, error: 'unknown action' });
    var learner = String(b.learner || '');
    if (!/^[a-f0-9]{6,16}$/.test(learner)) return out_({ ok: false, error: 'bad learner' });
    learner = 'L-' + learner;   // a letter first, so Sheets never turns a number like 12e45 into a number
    var group = String(b.group || '').replace(/[^\w-]/g, '').slice(0, 24).toLowerCase();
    var device = b.device === 'phone' ? 'phone' : 'computer';
    var items = b.items instanceof Array ? b.items.slice(0, 20) : [];
    if (!items.length) return out_({ ok: false, error: 'nothing to send' });

    var sh = tab_('Responses', HEAD), last = sh.getLastRow();
    var seen = last > 1 ? sh.getRange(2, 2, last - 1, 4).getValues() : [];
    var added = 0, dup = 0, bad = 0;
    items.forEach(function (it) {
      var n = LESSONS[it && it.lesson], ans = it && it.answers, picks = (it && it.picks) || [];
      var ok = !!n && ans instanceof Array && ans.length === n;
      for (var k = 0; ok && k < n; k++) if (ans[k] !== 0 && ans[k] !== 1) ok = false;
      if (!ok) { bad++; return; }
      var tries = Math.max(1, Math.min(99, parseInt(it.attempt, 10) || 1));
      // the same learner, lesson and try only counts once (a retaken final review sends the lessons again)
      for (var r = seen.length - 1; r >= 0; r--) {
        if (seen[r][0] === learner && seen[r][2] === it.lesson && Number(seen[r][3]) === tries) { dup++; return; }
      }
      var score = 0;
      for (k = 0; k < n; k++) score += ans[k];
      var row = [new Date(), learner, group, it.lesson, tries, score, n, score >= Math.ceil(n * 0.8) ? 'yes' : 'no',
        Math.round((Number(it.secs) || 0) / 6) / 10, device];
      for (k = 0; k < MAXQ; k++) row.push(k < n ? ans[k] : '');
      for (k = 0; k < MAXQ; k++) row.push(k < n && picks[k] >= 0 && picks[k] <= 3 ? 'ABCD'.charAt(picks[k]) : '');
      sh.appendRow(row);
      seen.push([learner, group, it.lesson, tries]);
      saveQuestions_(it.lesson, n, it.questions, it.key);
      added++;
    });
    return out_({ ok: added + dup > 0, added: added, dup: dup, bad: bad });
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
