#!/bin/sh
# Rebuilds ADS-tool-submission.zip (the tool, trimmed for submission) from the
# committed tool files, with submission/README.txt in place of the long README.md
# and a small made-up drive image (from the tests) to try the tool on.
set -e
cd "$(dirname "$0")/.."
git archive --format=zip --prefix="ADS tool/" -o ADS-tool-submission.zip HEAD:tool -- . \
  ':(exclude)README.md' ':(exclude)results/browser' ':(exclude)results/26Fall_Project1B_rerun' \
  ':(exclude)results/26Fall_Project2_dates/outcomes.csv' ':(exclude)results/26Fall_Project2_dates/scores.csv'
python3 - <<'PY'
import zipfile
text = open("submission/README.txt", encoding="utf-8").read().replace("\r\n", "\n").replace("\n", "\r\n")
import gzip
sample = gzip.open("tool/tests/fixtures/ntfs_small.img.gz").read()      # a made-up test drive, no real evidence
with zipfile.ZipFile("ADS-tool-submission.zip", "a", zipfile.ZIP_DEFLATED) as z:
    z.writestr("ADS tool/README.txt", text)
    z.writestr("ADS tool/sample/sample_drive.img", sample)
PY
echo "written ADS-tool-submission.zip"
