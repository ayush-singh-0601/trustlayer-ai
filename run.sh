#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || {
  echo "Node.js 22 or newer is required: https://nodejs.org/" >&2
  exit 1
}

node_major=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22 or newer is required. Installed major version: $node_major" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

exec npm start
