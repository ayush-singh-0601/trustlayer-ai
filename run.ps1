$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 22.16 or newer is required: https://nodejs.org/"
}

$nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
$nodeMinor = [int]((& node --version).TrimStart("v").Split(".")[1])
if ($nodeMajor -lt 22 -or ($nodeMajor -eq 22 -and $nodeMinor -lt 16)) {
    throw "Node.js 22.16 or newer is required. Installed version: $(& node --version)"
}

if (-not (Test-Path -LiteralPath "node_modules")) {
    npm.cmd install
}

npm.cmd start
