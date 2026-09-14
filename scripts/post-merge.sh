#!/bin/bash
set -euo pipefail

npm ci --prefix frontend --no-audit --no-fund
npm run build --prefix frontend
python -m compileall -q api data/economics