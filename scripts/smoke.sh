#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT/scripts/smoke-typecheck.sh"
"$ROOT/scripts/smoke-package-tests.sh"
