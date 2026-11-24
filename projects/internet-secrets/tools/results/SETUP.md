# Turn on anonymous results (about 10 minutes, once)

The lessons send each learner's right and wrong answers to a Google Sheet you own. Nothing is sent until the Sheet's script address is added to `lessons/shared/submit.js`.

## 1. Make the Sheet and paste the script

1. Go to https://sheets.new (signed in to the Google account you want to own the data). Name the Sheet, for example **Internet Secrets results**.
2. Click **Extensions > Apps Script**.
3. Delete everything in the editor, then paste all of `tools/results/Code.gs` from this repo. Click the save icon.
4. Optional: pick `setup` in the function list at the top and click **Run** (approve the access prompt). This makes the **Responses** and **Questions** tabs now; otherwise they appear with the first result.

## 2. Publish it as a web app

1. Click **Deploy > New deployment**. Click the gear next to "Select type" and pick **Web app**.
2. Description: `Internet Secrets results`. **Execute as: Me**. **Who has access: Anyone**.
3. Click **Deploy**, then **Authorize access** and allow it (Google may show "Google hasn't verified this app": click **Advanced**, then **Go to ... (unsafe)**; it is your own script).
4. Copy the **Web app URL** (it ends in `/exec`).

## 3. Connect the lessons

Send the `/exec` address to Claude and ask to connect it, or put it in `lessons/shared/submit.js` yourself:

```js
const ENDPOINT = 'https://script.google.com/macros/s/.../exec';
```

After that change is merged, the final review's score screen shows **Send my answers** (the lesson checks show it locked until then), and `lessons/results/` shows the live results.

## Running a tester session

- Share the lessons with a group tag so the class can be told apart from other visitors:
  `https://captainrussell.github.io/Portfolio/projects/internet-secrets/lessons/?group=afas3410`
  The tag sticks to that browser for every lesson.
- On a shared computer, press **Reset progress** on the lesson list between learners. It clears the scores and gives the next learner a new random number.
- Results page: `https://captainrussell.github.io/Portfolio/projects/internet-secrets/lessons/results/` (first try only by default, since a retake comes after the learner has seen the answers). **Summary CSV** gives percent correct per question; **Every answer CSV** gives one row per quiz. The Sheet itself (File > Download > CSV) holds the same rows.

## What is stored

Learners send once, from the end of the final review. That send adds one row per quiz: each lesson's first try, its latest try if they retook it, and the final review. Each row has the time, random learner number, group tag, lesson, which try on that browser, score, minutes in the lesson, phone or computer, right (1) or wrong (0) for each question, and the letter picked. No name, email, account or IP address. A quiz that was already sent is ignored, so a retaken final review only adds the new rows.

## Changing the script later

Paste the new code, then **Deploy > Manage deployments**, the pencil icon, **Version: New version**, **Deploy**. The `/exec` address stays the same.

To clear test rows before the real sessions, delete those rows in the **Responses** tab.
