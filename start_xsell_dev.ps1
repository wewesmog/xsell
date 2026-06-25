# Quick local dev launcher for Xsell (testing only).
# Requires: Python 3.11+ and Node.js 20+ on PATH.
# Opens backend (8000) + frontend (3000) in two terminals, then the browser.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Install Python 3.11+ and try again." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Node/npm not found. Install Node.js 20+ and try again." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Xsell backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$backendCmd = @"
Set-Location '$backend'
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt
python scripts\apply_migration.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Start-Sleep -Seconds 3

Write-Host "Starting Xsell frontend on http://localhost:3000 ..." -ForegroundColor Cyan
$frontendCmd = @"
Set-Location '$frontend'
if (-not (Test-Path node_modules)) { npm install }
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 8
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "Xsell is starting. Keep both terminal windows open while testing." -ForegroundColor Green
Write-Host "Backend health: http://127.0.0.1:8000/health" -ForegroundColor Gray
Write-Host "UI:             http://localhost:3000" -ForegroundColor Gray
