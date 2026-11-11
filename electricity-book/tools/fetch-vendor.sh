#!/usr/bin/env bash
# 下載測試時要用的 three.js 檔案到 tools/vendor（測試腳本會優先用這些本機檔案）
set -euo pipefail
cd "$(dirname "$0")"
B=https://cdn.jsdelivr.net/npm/three@0.160.0
for f in build/three.module.js examples/jsm/controls/OrbitControls.js examples/jsm/geometries/RoundedBoxGeometry.js; do
  mkdir -p "vendor/three/$(dirname "$f")"
  curl -sSf "$B/$f" -o "vendor/three/$f"
  echo "ok $f"
done
