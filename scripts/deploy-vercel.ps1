$ErrorActionPreference = "Stop"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " GitSpar Web — Automated Vercel Production Deployment" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path (Split-Path -Parent $ScriptDir) "web"

Set-Location $WebDir
Write-Host "Step 1: Installing dependencies in $WebDir..." -ForegroundColor Yellow
npm install

Write-Host "Step 2: Building Next.js 15 production bundle..." -ForegroundColor Yellow
npm run build

Write-Host "Step 3: Deploying to Vercel Production via Vercel CLI..." -ForegroundColor Yellow
npx vercel --prod --yes

Write-Host "=========================================================" -ForegroundColor Green
Write-Host " ✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
