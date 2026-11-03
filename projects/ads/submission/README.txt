ARTIFACT DISAGREEMENT SCORER
Created by Captain Scott Russell for CYBSC 5360, Iowa State University

The tool behind the term paper "Cross-Checking Windows Artifacts to Detect
Anti-Forensic Tampering". It compares the separate records a drive keeps about
each file, flags the files where those records disagree, and explains every
flag in plain English. Drive images are only read, never changed.


1. QUICK START (no installation)

   Double-click "Artifact Disagreement Scorer.html". It opens in Chrome, Edge
   or Firefox. Drop a drive image (.img, .dd or .raw) on the page, watch the
   analysis, then open the "First look" and "Date checks" reports.
   Everything runs on your own computer; nothing is uploaded.

   No drive image at hand? Use sample\sample_drive.img: a small made-up
   Windows-style drive (no real evidence) that takes a few seconds.
   This live view is what Fig. 4 of the paper shows.


2. THE RESULTS IN THE PAPER (no drive image needed)

   Open these pages in a browser:

   results\26Fall_Project2\briefing.html         Project 2 first look
                                                 (Figs. 1, 3 and 5 to 7)
   results\26Fall_Project2_dates\briefing.html   Project 2 date checks (Fig. 8)
   results\26Fall_Project1B\briefing.html        Project 1 first look

   The proof.html page in each folder shows where the tool ranked each file
   from my hand-made answer key.


3. COMMAND LINE (needs Python 3, nothing else)

   Windows:  double-click "Run ADS (Windows).bat" for a point-and-click
             window, or drag a drive image onto it for a quick report.
   Mac:      double-click "Run ADS (Mac).command".
   Any:      python -m ads IMAGE.img       first-look report on an image
             python -m ads gui             point-and-click window

   Type the commands in this folder. On Windows, if "python" is not found,
   type py instead; on a Mac or Linux computer, type python3.


4. RE-CHECK THE PAPER'S NUMBERS

   python -m ads proof --results results/26Fall_Project2
                       --key proof/project2_answer_key.csv
   python -m ads proof --results results/26Fall_Project1B
                       --key proof/project1_answer_key.csv
   (type each command on one line)

   Expected: 7 of 16 evidence files listed (5 in the top 10) for Project 2,
   and 7 of 7 (6 in the top 10) for Project 1.


5. RUN THE TESTS

   python -m unittest discover -s tests

   59 tests. tests\test_freeze.py shows the eight first-look questions were
   locked on 20 October 2026, before Project 2 was examined.


6. WHAT IS IN THIS FOLDER

   Artifact Disagreement Scorer.html   the whole tool as one offline web page
   ads\        the tool's code (Python 3 standard library only)
   web\        source code of the web page
   proof\      answer keys for Projects 1 and 2, and how they were scored
   results\    the saved reports used in the paper
   sample\     a small made-up drive image to try the tool on
   tests\      automated tests
   scripts\    helper for full Windows systems (runs Eric Zimmerman's
               record parsers); not needed for the course drives
