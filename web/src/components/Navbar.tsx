"use client";

import Link from "next/link";
import { Shield, Terminal, Github, Activity, LayoutDashboard, Cpu } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-500 group-hover:border-blue-500 group-hover:scale-105 transition-all">
            <Shield className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
            <div className="absolute -inset-0.5 bg-blue-500/20 rounded-xl blur-sm -z-10 group-hover:bg-blue-500/30 transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-blue-200 transition-colors">
              GitSpar
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              v0.3.0
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link href="/#problem" className="hover:text-white transition-colors">
            Why GitSpar
          </Link>
          <Link href="/#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </Link>
          <Link href="/demo" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Live Simulator
          </Link>
          <Link href="/dashboard" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <LayoutDashboard className="w-4 h-4 text-blue-400" />
            Dashboard
          </Link>
          <Link href="/#differentiation" className="hover:text-white transition-colors">
            Comparison
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/devanshdoshi8-byte/gitspar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-mono font-medium transition-colors"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/demo"
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/40"
          >
            <Activity className="w-4 h-4" />
            <span>Try Sandbox</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
