# GitSpar Web — Deployment Guide

> **Live Production URL:** [https://gitspar.vercel.app](https://gitspar.vercel.app)  
> **Status:** 🟢 Live & Healthy (HTTP 200 on all routes)

This repository contains the full Next.js 15 web application for **GitSpar** located in the `web/` directory, including:
- **Marketing & Architecture Landing Page** (`/`)
- **Live Interactive Mutation Simulator** (`/demo`)
- **Clean-Room Verification Portal** (`/verify/[id]`)
- **Reviewer & Maintainer Leaderboard Dashboard** (`/dashboard`)

---

## Option 1: 1-Click Zero-Friction Vercel CLI Deployment

Run the automated deployment script from your terminal:

### On Linux / macOS / Git Bash:
```bash
chmod +x scripts/deploy-vercel.sh
./scripts/deploy-vercel.sh
```

### On Windows PowerShell:
```powershell
.\scripts\deploy-vercel.ps1
```

### Manual CLI Invocations:
```bash
cd web
npm install
npm run build
npx vercel --prod
```

`web/vercel.json` is pre-configured with the Next.js framework build commands.

---

## Option 2: Connect GitHub Repository to Vercel Dashboard

To set up continuous deployment with automatic PR preview branches and master deployments:

1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Select and import the repository: **`devanshdoshi8-byte/gitspar`**.
3. In the project setup screen, configure the following settings:
   - **Root Directory:** Edit root directory and select `web` (or enter `web`).
   - **Framework Preset:** `Next.js` (automatically detected).
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
   - **Output Directory:** `.next`
4. Click **Deploy**.
5. Once deployed, Vercel will assign a production URL (e.g. `https://gitspar-web.vercel.app`) and automatically deploy every commit pushed to `master`.

---

## Option 3: Local Development Server

Run the web portal locally alongside the GitSpar CLI engine:

```bash
# In repository root
npm run web:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Pre-Deployment Verification Checklist

Before pushing or deploying, verify:

```bash
# 1. Run engine test suite (100% pass)
npm test

# 2. Run Next.js 15 production build
npm run web:build

# 3. Run automated engine benchmark suite
npm run experiment
```
