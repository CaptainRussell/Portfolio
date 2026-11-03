#!/usr/bin/env bash
# Refresh the ADS files in projects/ads/ from a checkout of CaptainRussell/CYBSC5360Project.
# Usage: tools/sync-ads.sh PATH/TO/CYBSC5360Project
set -euo pipefail
SRC="${1:?give the path to a CYBSC5360Project checkout}"
DST="$(cd "$(dirname "$0")/.." && pwd)/projects/ads"
cp "$SRC/tool/Artifact Disagreement Scorer.html" "$DST/app.html"
cp "$SRC/ADS-tool-submission.zip"                  "$DST/downloads/ADS-tool.zip"
cp "$SRC/paper/CPRE 5360 Term Paper Draft - Russell.pdf" "$DST/downloads/Russell_ADS_Term_Paper.pdf"
unzip -o -q -j "$SRC/ADS-tool-submission.zip" "ADS tool/sample/sample_drive.img" -d "$DST/downloads/"
cp "$SRC/paper/figures/fig1_pipeline.png" "$SRC/paper/figures/shot_funnel.png" "$DST/img/"
echo "Synced ADS files from $SRC. Check the file names above if the source repo renamed anything (e.g. the final paper)."
