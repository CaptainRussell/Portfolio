#!/bin/sh
# Rebuilds ADS-tool-submission.zip (the tool, trimmed for submission) from the
# committed tool files, with submission/README.txt in place of the long README.md
# and the small made-up sample drive (tool/sample/sample_drive.img, from the
# tests) to try the tool on. Commit first: it archives HEAD.
set -e
cd "$(dirname "$0")/.."
PREFIX=$(git rev-parse --show-prefix)          # where this project sits in the repository
git -C "$(git rev-parse --show-toplevel)" archive --format=zip --prefix="ADS tool/" -o "$PWD/ADS-tool-submission.zip" "HEAD:${PREFIX}tool" -- . \
  ':(exclude)README.md' ':(exclude)results/browser' ':(exclude)results/26Fall_Project1B_rerun' \
  ':(exclude)results/26Fall_Project2_dates/outcomes.csv' ':(exclude)results/26Fall_Project2_dates/scores.csv'
python3 - <<'PY'
import zipfile
text = open("submission/README.txt", encoding="utf-8").read().replace("\r\n", "\n").replace("\n", "\r\n")
with zipfile.ZipFile("ADS-tool-submission.zip", "a", zipfile.ZIP_DEFLATED) as z:
    z.writestr("ADS tool/README.txt", text)
PY
echo "written ADS-tool-submission.zip"
