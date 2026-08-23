#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || {
  echo "Node.js 22.16 or newer is required: https://nodejs.org/" >&2
  exit 1
}

node_supported=$(node -p "const [major, minor] = process.versions.node.split('.').map(Number); major > 22 || (major === 22 && minor >= 16) ? 'yes' : 'no'")
if [ "$node_supported" != yes ]; then
  echo "Node.js 22.16 or newer is required. Installed version: $(node --version)" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

exec npm start
