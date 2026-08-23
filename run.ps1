$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 22 or newer is required: https://nodejs.org/"
}

$nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) {
    throw "Node.js 22 or newer is required. Installed major version: $nodeMajor"
}

if (-not (Test-Path -LiteralPath "node_modules")) {
    npm.cmd install
}

npm.cmd start
