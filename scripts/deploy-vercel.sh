#!/usr/bin/env bash
set -e

echo "========================================================="
echo " GitSpar Web — Automated Vercel Production Deployment"
echo "========================================================="

# Navigate to web directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR/web"

echo "Step 1: Installing web dependencies..."
npm install

echo "Step 2: Building Next.js 15 production bundle..."
npm run build

echo "Step 3: Deploying to Vercel Production via Vercel CLI..."
npx vercel --prod --yes --scope devanshdoshi8-7922s-projects

echo "========================================================="
echo " ✅ Deployment completed successfully!"
echo "========================================================="
